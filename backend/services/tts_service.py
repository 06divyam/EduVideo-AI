"""Text-to-speech for lesson narration.

The service is provider-agnostic: callers use ``synthesize_narration`` and
receive a WAV file on disk. Providers only turn a chunk of text into PCM
audio, so swapping Gemini for another engine means adding one class that
implements ``TtsProvider`` and selecting it with the ``TTS_PROVIDER`` env var.

Gemini TTS returns 24 kHz, mono, 16-bit PCM (a WAV with a RIFF header for
unary requests). Raw ``audio/L16`` PCM is also accepted defensively.
"""

import io
import logging
import os
import re
import threading
import time
import unicodedata
import uuid
import wave
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from google.genai import types

from config import (
    AUDIO_DIR,
    GEMINI_TTS_MODEL,
    GEMINI_TTS_VOICE,
    MAX_NARRATION_CHARS,
    TTS_CHUNK_CHARS,
    TTS_PROVIDER,
    TTS_TIMEOUT_SECONDS,
)
from services.gemini_service import (
    GeminiServiceError,
    get_client,
    is_configured as gemini_is_configured,
    map_gemini_exception,
    retry_delay_seconds,
)

logger = logging.getLogger(__name__)

MIN_NARRATION_CHARS = 2
CHUNK_PAUSE_SECONDS = 0.25
DEFAULT_PCM_RATE = 24_000
RATE_LIMIT_RETRIES = 2
MAX_RETRY_WAIT_SECONDS = 60

# Only one narration is generated at a time (project constraint; also keeps
# Gemini quota use predictable).
_generation_lock = threading.Lock()


class TtsServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class AudioClip:
    pcm: bytes
    sample_rate: int
    channels: int
    sample_width: int  # bytes per sample


@dataclass(frozen=True)
class NarrationAudio:
    audio_id: str
    path: Path
    provider: str
    model: str
    voice: str
    text_length: int
    chunk_count: int
    duration_seconds: float
    sample_rate: int
    channels: int
    sample_width_bits: int
    size_bytes: int


class TtsProvider(Protocol):
    name: str
    model: str
    default_voice: str
    voices: frozenset[str]

    def is_configured(self) -> bool: ...

    def synthesize(self, text: str, voice: str) -> AudioClip: ...


# Prebuilt Gemini TTS voices.
GEMINI_VOICES = frozenset(
    {
        "Achernar", "Achird", "Algenib", "Algieba", "Alnilam", "Aoede",
        "Autonoe", "Callirrhoe", "Charon", "Despina", "Enceladus", "Erinome",
        "Fenrir", "Gacrux", "Iapetus", "Kore", "Laomedeia", "Leda", "Orus",
        "Puck", "Pulcherrima", "Rasalgethi", "Sadachbia", "Sadaltager",
        "Schedar", "Sulafat", "Umbriel", "Vindemiatrix", "Zephyr",
        "Zubenelgenubi",
    }
)


class GeminiTtsProvider:
    name = "gemini"
    voices = GEMINI_VOICES

    def __init__(self, model: str, default_voice: str) -> None:
        self.model = model
        self.default_voice = default_voice

    def is_configured(self) -> bool:
        return gemini_is_configured()

    def synthesize(self, text: str, voice: str) -> AudioClip:
        try:
            client = get_client()
        except GeminiServiceError as exc:
            raise TtsServiceError(exc.code, exc.message, exc.status_code) from exc

        config = types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name=voice
                    )
                )
            ),
            http_options=types.HttpOptions(timeout=TTS_TIMEOUT_SECONDS * 1000),
        )

        response = None
        for attempt in range(1, RATE_LIMIT_RETRIES + 2):
            try:
                response = client.models.generate_content(
                    model=self.model,
                    contents=text,
                    config=config,
                )
                break
            except Exception as exc:
                mapped = map_gemini_exception(exc)
                delay = retry_delay_seconds(exc)
                # Per-minute limits clear quickly: wait and retry. Daily
                # quota and other errors are reported immediately.
                if (
                    mapped.code == "gemini_rate_limited"
                    and delay is not None
                    and delay <= MAX_RETRY_WAIT_SECONDS
                    and attempt <= RATE_LIMIT_RETRIES
                ):
                    logger.warning("Gemini TTS rate limited; retrying in %.1fs", delay)
                    time.sleep(delay + 1)
                    continue
                logger.exception("Gemini TTS request failed")
                raise TtsServiceError(
                    mapped.code, mapped.message, mapped.status_code
                ) from exc

        blob = _first_audio_blob(response)
        if blob is None or not blob.data:
            raise TtsServiceError(
                "tts_empty_audio",
                "Gemini returned no audio for this narration. Please try again.",
            )

        return _decode_audio(blob.data, blob.mime_type or "")


def _first_audio_blob(response: object) -> types.Blob | None:
    for candidate in getattr(response, "candidates", None) or []:
        content = getattr(candidate, "content", None)
        for part in getattr(content, "parts", None) or []:
            blob = getattr(part, "inline_data", None)
            if blob is not None and (blob.mime_type or "").startswith("audio/"):
                return blob
    return None


def _decode_audio(data: bytes, mime_type: str) -> AudioClip:
    if data[:4] == b"RIFF":
        try:
            with wave.open(io.BytesIO(data), "rb") as source:
                return AudioClip(
                    pcm=source.readframes(source.getnframes()),
                    sample_rate=source.getframerate(),
                    channels=source.getnchannels(),
                    sample_width=source.getsampwidth(),
                )
        except (wave.Error, EOFError) as exc:
            raise TtsServiceError(
                "tts_invalid_audio",
                "The TTS provider returned unreadable audio. Please try again.",
            ) from exc

    lowered = mime_type.lower()
    if lowered.startswith(("audio/l16", "audio/pcm")):
        match = re.search(r"rate=(\d+)", lowered)
        rate = int(match.group(1)) if match else DEFAULT_PCM_RATE
        return AudioClip(pcm=data, sample_rate=rate, channels=1, sample_width=2)

    logger.warning("Unsupported TTS audio format: %s", mime_type)
    raise TtsServiceError(
        "tts_invalid_audio",
        "The TTS provider returned an unsupported audio format.",
    )


def get_provider() -> TtsProvider:
    if TTS_PROVIDER == "gemini":
        return GeminiTtsProvider(GEMINI_TTS_MODEL, GEMINI_TTS_VOICE)

    raise TtsServiceError(
        "tts_not_configured",
        f"Unknown TTS_PROVIDER '{TTS_PROVIDER}'. Set TTS_PROVIDER=gemini in backend/.env.",
        status_code=503,
    )


def is_configured() -> bool:
    try:
        return get_provider().is_configured()
    except TtsServiceError:
        return False


def normalize_narration_text(text: str) -> str:
    """Drop control characters and collapse whitespace; enforce length."""
    cleaned = "".join(
        " " if unicodedata.category(char).startswith("C") else char
        for char in text
    )
    cleaned = re.sub(r"\s+", " ", cleaned).strip()

    if len(cleaned) < MIN_NARRATION_CHARS or not any(
        char.isalnum() for char in cleaned
    ):
        raise TtsServiceError(
            "empty_narration",
            "Enter some narration text to convert to speech.",
            status_code=422,
        )

    if len(cleaned) > MAX_NARRATION_CHARS:
        raise TtsServiceError(
            "narration_too_long",
            f"Narration is {len(cleaned):,} characters; the limit is "
            f"{MAX_NARRATION_CHARS:,} per request. Split it into shorter scenes.",
            status_code=422,
        )

    return cleaned


def split_narration(text: str, max_chars: int = TTS_CHUNK_CHARS) -> list[str]:
    """Split at sentence boundaries so each provider call stays small."""
    if len(text) <= max_chars:
        return [text]

    pieces: list[str] = []
    for sentence in re.split(r"(?<=[.!?…])\s+", text):
        while len(sentence) > max_chars:
            cut = sentence.rfind(" ", 0, max_chars)
            cut = cut if cut > 0 else max_chars
            pieces.append(sentence[:cut].strip())
            sentence = sentence[cut:].strip()
        if sentence:
            pieces.append(sentence)

    chunks: list[str] = []
    current = ""
    for piece in pieces:
        candidate = f"{current} {piece}".strip()
        if len(candidate) <= max_chars:
            current = candidate
        else:
            chunks.append(current)
            current = piece
    if current:
        chunks.append(current)

    return chunks


def _write_wav(clips: list[AudioClip], destination: Path) -> tuple[float, AudioClip]:
    first = clips[0]
    for clip in clips[1:]:
        if (clip.sample_rate, clip.channels, clip.sample_width) != (
            first.sample_rate,
            first.channels,
            first.sample_width,
        ):
            raise TtsServiceError(
                "tts_invalid_audio",
                "The TTS provider returned inconsistent audio formats.",
            )

    frame_bytes = first.channels * first.sample_width
    silence = b"\x00" * (int(first.sample_rate * CHUNK_PAUSE_SECONDS) * frame_bytes)
    pcm = silence.join(clip.pcm for clip in clips)

    temp_path = destination.with_name(f".{destination.name}.tmp")
    try:
        with wave.open(str(temp_path), "wb") as output:
            output.setnchannels(first.channels)
            output.setsampwidth(first.sample_width)
            output.setframerate(first.sample_rate)
            output.writeframes(pcm)
        os.replace(temp_path, destination)
    except OSError as exc:
        temp_path.unlink(missing_ok=True)
        logger.exception("Failed to write narration audio")
        raise TtsServiceError(
            "storage_error",
            "The narration audio could not be saved. Please try again.",
            status_code=500,
        ) from exc

    duration = len(pcm) / (frame_bytes * first.sample_rate)
    return duration, first


def synthesize_narration(
    text: str,
    voice: str | None = None,
    *,
    destination: Path | None = None,
    wait: bool = False,
) -> NarrationAudio:
    """Convert narration text into a WAV file.

    By default the file goes to storage/audio/<uuid>.wav and the call fails
    fast if another narration is running. The video pipeline passes its own
    ``destination`` and ``wait=True`` so scenes queue behind the lock.
    """
    provider = get_provider()

    if not provider.is_configured():
        raise TtsServiceError(
            "tts_not_configured",
            "Text-to-speech is not configured on the backend. Add GEMINI_API_KEY to backend/.env.",
            status_code=503,
        )

    cleaned = normalize_narration_text(text)
    chosen_voice = (voice or provider.default_voice).strip()
    matched = next(
        (name for name in provider.voices if name.lower() == chosen_voice.lower()),
        None,
    )
    if matched is None:
        raise TtsServiceError(
            "invalid_voice",
            f"Unknown voice '{chosen_voice}'. Choose one of: "
            f"{', '.join(sorted(provider.voices))}.",
            status_code=422,
        )

    acquired = (
        _generation_lock.acquire(timeout=TTS_TIMEOUT_SECONDS)
        if wait
        else _generation_lock.acquire(blocking=False)
    )
    if not acquired:
        raise TtsServiceError(
            "tts_busy",
            "Another narration is being generated. Wait for it to finish and try again.",
            status_code=409,
        )

    try:
        chunks = split_narration(cleaned)
        clips = [provider.synthesize(chunk, matched) for chunk in chunks]

        if destination is None:
            audio_id = str(uuid.uuid4())
            destination = AUDIO_DIR / f"{audio_id}.wav"
        else:
            audio_id = destination.stem
        destination.parent.mkdir(parents=True, exist_ok=True)
        duration, audio_format = _write_wav(clips, destination)
    finally:
        _generation_lock.release()

    return NarrationAudio(
        audio_id=audio_id,
        path=destination,
        provider=provider.name,
        model=provider.model,
        voice=matched,
        text_length=len(cleaned),
        chunk_count=len(chunks),
        duration_seconds=round(duration, 2),
        sample_rate=audio_format.sample_rate,
        channels=audio_format.channels,
        sample_width_bits=audio_format.sample_width * 8,
        size_bytes=destination.stat().st_size,
    )


def resolve_audio_path(stored_path: str) -> Path | None:
    """Return the stored file only if it is a WAV inside AUDIO_DIR."""
    path = Path(stored_path).resolve()
    audio_root = AUDIO_DIR.resolve()

    if path.parent != audio_root or path.suffix != ".wav" or not path.is_file():
        return None

    return path
