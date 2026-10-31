"""Provider selection and error handling for text-to-speech.

Run from backend/:  .venv/bin/python -m unittest discover -s tests -t .

No network access: Murf HTTP calls go through httpx.MockTransport.
"""

import base64
import io
import json
import tempfile
import unittest
import wave
from pathlib import Path
from unittest import mock

import httpx

from services import tts_service, video_service
from services.tts_service import (
    GeminiTtsProvider,
    MurfTtsProvider,
    TtsServiceError,
)


def wav_bytes(seconds: float = 0.5, rate: int = 24_000) -> bytes:
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(rate)
        output.writeframes(b"\x01\x00" * int(rate * seconds))
    return buffer.getvalue()


VOICES = [{"voiceId": "en-US-natalie"}, {"voiceId": "es-ES-carla"}]


def murf(handler, **kwargs) -> MurfTtsProvider:
    return MurfTtsProvider(
        "test-key",
        "en-US-natalie",
        transport=httpx.MockTransport(handler),
        retry_delays=(0.0, 0.0),
        **kwargs,
    )


class ProviderSelectionTests(unittest.TestCase):
    def test_murf_selected(self):
        with mock.patch.object(tts_service, "TTS_PROVIDER", "murf"):
            self.assertIsInstance(tts_service.get_provider(), MurfTtsProvider)

    def test_gemini_still_selectable(self):
        with mock.patch.object(tts_service, "TTS_PROVIDER", "gemini"):
            provider = tts_service.get_provider()
        self.assertIsInstance(provider, GeminiTtsProvider)
        self.assertEqual(provider.voice_for_language("Arabic"), provider.default_voice)

    def test_unknown_provider_rejected(self):
        with mock.patch.object(tts_service, "TTS_PROVIDER", "nope"):
            with self.assertRaises(TtsServiceError) as ctx:
                tts_service.get_provider()
        self.assertEqual(ctx.exception.code, "tts_not_configured")

    def test_murf_is_default_in_config(self):
        import config

        with mock.patch.dict("os.environ", {}, clear=True), mock.patch(
            "dotenv.load_dotenv"
        ):
            import importlib

            reloaded = importlib.reload(config)
            self.assertEqual(reloaded.TTS_PROVIDER, "murf")
        importlib.reload(config)

    def test_missing_murf_key_is_clear_error(self):
        provider = MurfTtsProvider("", "en-US-natalie")
        self.assertFalse(provider.is_configured())
        with mock.patch.object(tts_service, "get_provider", return_value=provider):
            with self.assertRaises(TtsServiceError) as ctx:
                tts_service.synthesize_narration("Hello students.")
        self.assertEqual(ctx.exception.code, "tts_not_configured")
        self.assertIn("MURF_API_KEY", ctx.exception.message)


class MurfVoiceTests(unittest.TestCase):
    def test_language_defaults(self):
        provider = MurfTtsProvider("k", "en-US-natalie")
        self.assertEqual(provider.voice_for_language("English"), "en-US-natalie")
        self.assertEqual(provider.voice_for_language("Spanish"), "es-ES-carla")

    def test_arabic_unsupported(self):
        with self.assertRaises(TtsServiceError) as ctx:
            MurfTtsProvider("k", "en-US-natalie").voice_for_language("Arabic")
        self.assertEqual(ctx.exception.code, "tts_language_unsupported")
        self.assertEqual(ctx.exception.status_code, 422)


class MurfSynthesisTests(unittest.TestCase):
    def test_success_decodes_base64_wav(self):
        seen = {}

        def handler(request: httpx.Request) -> httpx.Response:
            seen["headers"] = request.headers
            seen["body"] = json.loads(request.content)
            return httpx.Response(
                200,
                json={
                    "encodedAudio": base64.b64encode(wav_bytes()).decode(),
                    "audioLengthInSeconds": 0.5,
                    "remainingCharacterCount": 1000,
                },
            )

        clip = murf(handler).synthesize("Plants make food.", "en-US-natalie")
        self.assertEqual((clip.sample_rate, clip.channels, clip.sample_width), (24_000, 1, 2))
        self.assertEqual(len(clip.pcm), 24_000)
        self.assertEqual(seen["headers"]["api-key"], "test-key")
        body = seen["body"]
        self.assertEqual(body["format"], "WAV")
        self.assertEqual(body["channelType"], "MONO")
        self.assertEqual(body["sampleRate"], 24_000)
        self.assertTrue(body["encodeAsBase64"])
        self.assertNotIn("style", body)

    def test_style_sent_when_configured(self):
        captured = {}

        def handler(request):
            captured.update(json.loads(request.content))
            return httpx.Response(
                200, json={"encodedAudio": base64.b64encode(wav_bytes()).decode()}
            )

        murf(handler, style="Conversational").synthesize("Hi there.", "en-US-natalie")
        self.assertEqual(captured["style"], "Conversational")

    def assert_error(self, status: int, code: str, body=None):
        calls = []

        def handler(request):
            calls.append(1)
            return httpx.Response(status, json=body or {"errorMessage": "boom"})

        with self.assertRaises(TtsServiceError) as ctx:
            murf(handler).synthesize("Hello.", "en-US-natalie")
        self.assertEqual(ctx.exception.code, code)
        self.assertNotIn("test-key", ctx.exception.message)
        return ctx.exception, len(calls)

    def test_auth_error(self):
        self.assert_error(401, "tts_auth_failed")
        self.assert_error(403, "tts_auth_failed")

    def test_quota_error(self):
        exc, _ = self.assert_error(402, "tts_quota_exceeded")
        self.assertEqual(exc.status_code, 402)

    def test_bad_request_includes_murf_message(self):
        exc, calls = self.assert_error(400, "tts_bad_request", {"errorMessage": "Invalid voiceId"})
        self.assertIn("Invalid voiceId", exc.message)
        self.assertEqual(calls, 1)

    def test_rate_limit_retried_then_reported(self):
        _, calls = self.assert_error(429, "tts_rate_limited")
        self.assertEqual(calls, 3)

    def test_server_error_retried_then_unavailable(self):
        _, calls = self.assert_error(503, "tts_unavailable")
        self.assertEqual(calls, 3)

    def test_retry_recovers(self):
        responses = [
            httpx.Response(429, json={}),
            httpx.Response(200, json={"encodedAudio": base64.b64encode(wav_bytes()).decode()}),
        ]
        clip = murf(lambda request: responses.pop(0)).synthesize("Hi.", "en-US-natalie")
        self.assertEqual(clip.sample_rate, 24_000)

    def test_timeout(self):
        def handler(request):
            raise httpx.ReadTimeout("slow", request=request)

        with self.assertRaises(TtsServiceError) as ctx:
            murf(handler).synthesize("Hello.", "en-US-natalie")
        self.assertEqual(ctx.exception.code, "tts_timeout")

    def test_empty_audio(self):
        with self.assertRaises(TtsServiceError) as ctx:
            murf(lambda r: httpx.Response(200, json={})).synthesize("Hi.", "en-US-natalie")
        self.assertEqual(ctx.exception.code, "tts_empty_audio")

    def test_unreadable_audio(self):
        bad = base64.b64encode(b"not audio").decode()
        with self.assertRaises(TtsServiceError) as ctx:
            murf(lambda r: httpx.Response(200, json={"encodedAudio": bad})).synthesize(
                "Hi.", "en-US-natalie"
            )
        self.assertEqual(ctx.exception.code, "tts_invalid_audio")


class SynthesizeNarrationTests(unittest.TestCase):
    def setUp(self):
        tts_service._murf_voice_cache = None

    def tearDown(self):
        tts_service._murf_voice_cache = None

    def test_murf_end_to_end_writes_wav_and_respects_request_limit(self):
        texts = []

        def handler(request):
            if request.url.path == "/v1/speech/voices":
                return httpx.Response(200, json=VOICES)
            texts.append(json.loads(request.content)["text"])
            return httpx.Response(
                200, json={"encodedAudio": base64.b64encode(wav_bytes(0.2)).decode()}
            )

        provider = murf(handler)
        provider.max_request_chars = 60
        sentence = "Plants turn sunlight into chemical energy. "
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(
            tts_service, "get_provider", return_value=provider
        ):
            audio = tts_service.synthesize_narration(
                sentence * 4,
                "EN-us-NATALIE",
                destination=Path(tmp) / "out.wav",
                max_chunk_chars=10_000,
            )
            self.assertTrue(audio.path.exists())
        self.assertEqual(audio.provider, "murf")
        self.assertEqual(audio.voice, "en-US-natalie")
        self.assertEqual(audio.sample_rate, 24_000)
        self.assertTrue(all(len(text) <= 60 for text in texts))
        self.assertEqual(audio.chunk_count, len(texts))

    def test_unknown_murf_voice(self):
        provider = murf(lambda r: httpx.Response(200, json=VOICES))
        with mock.patch.object(tts_service, "get_provider", return_value=provider):
            with self.assertRaises(TtsServiceError) as ctx:
                tts_service.synthesize_narration("Hello class.", "Kore")
        self.assertEqual(ctx.exception.code, "invalid_voice")


class VideoGroupingTests(unittest.TestCase):
    def test_groups_fit_murf_limit(self):
        narrations = ["a" * 700] * 7  # ~5-minute lesson
        groups = video_service._group_scenes(narrations, 3000)
        self.assertEqual(groups, [[0, 1, 2, 3], [4, 5, 6]])

    def test_short_lesson_is_one_request(self):
        self.assertEqual(video_service._group_scenes(["a" * 400] * 4, 3000), [[0, 1, 2, 3]])


if __name__ == "__main__":
    unittest.main()
