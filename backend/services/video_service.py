"""Video generation pipeline orchestration.

One job at a time, run in a background thread:

    1. script     – Gemini lesson script (lesson_service)
    2. narration  – one WAV per scene (tts_service)
    3. slides     – one PNG per scene (slide_service)
    4. assembling – single narration track + timed slides -> MP4 (ffmpeg_service)

Progress and errors are persisted in the ``videos`` table so the frontend can
poll. Temporary files live in storage/tmp/<video_id>/ and are always removed;
on failure, partial outputs are deleted too.
"""

import json
import logging
import re
import shutil
import threading
import uuid
import wave
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from config import VIDEO_DIR, VIDEO_WORK_DIR
from database import (
    DocumentRecord,
    create_video,
    fail_interrupted_videos,
    get_active_video,
    update_video,
)
from schemas import LessonScript
from services import ffmpeg_service, slide_service, tts_service
from services.ffmpeg_service import FfmpegError
from services.gemini_service import GeminiServiceError
from services.gemini_service import is_configured as gemini_is_configured
from services.lesson_service import LessonOptions, generate_lesson_script
from services.pdf_service import PdfServiceError, load_document_text
from services.slide_service import SlideServiceError
from services.tts_service import TtsServiceError

logger = logging.getLogger(__name__)

SCENE_GAP_SECONDS = 0.7
FINAL_TAIL_SECONDS = 1.2

_start_lock = threading.Lock()


class VideoServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class VideoOptions:
    level: str
    language: str
    duration_minutes: int
    style: str
    voice: str


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def recover_interrupted_jobs() -> None:
    """Called at startup: no thread survives a restart, so fail stale jobs."""
    count = fail_interrupted_videos(
        "Video generation was interrupted because the server restarted. Please try again.",
        now_iso(),
    )
    if count:
        logger.warning("Marked %d interrupted video job(s) as failed", count)
    if VIDEO_WORK_DIR.exists():
        for leftover in VIDEO_WORK_DIR.iterdir():
            if leftover.is_dir():
                shutil.rmtree(leftover, ignore_errors=True)


def start_video_job(document: DocumentRecord, options: VideoOptions) -> str:
    """Validate preconditions, record a queued job, and start the worker."""
    try:
        ffmpeg_service.require_available()
    except FfmpegError as exc:
        raise VideoServiceError(exc.code, exc.message, exc.status_code) from exc

    if not gemini_is_configured():
        raise VideoServiceError(
            "gemini_not_configured",
            "Gemini is not configured on the backend. Add GEMINI_API_KEY to backend/.env.",
            status_code=503,
        )

    try:
        slide_service.check_language_supported(options.language)
    except SlideServiceError as exc:
        raise VideoServiceError(exc.code, exc.message, exc.status_code) from exc

    try:
        provider = tts_service.get_provider()
    except TtsServiceError as exc:
        raise VideoServiceError(exc.code, exc.message, exc.status_code) from exc
    voice = next(
        (name for name in provider.voices if name.lower() == options.voice.strip().lower()),
        None,
    )
    if voice is None:
        raise VideoServiceError(
            "invalid_voice",
            f"Unknown voice '{options.voice}'. Choose one of: {', '.join(sorted(provider.voices))}.",
            status_code=422,
        )
    options = VideoOptions(
        level=options.level,
        language=options.language,
        duration_minutes=options.duration_minutes,
        style=options.style,
        voice=voice,
    )

    with _start_lock:
        active = get_active_video()
        if active is not None:
            raise VideoServiceError(
                "video_busy",
                "Another video is being generated. Wait for it to finish before starting a new one.",
                status_code=409,
            )

        video_id = str(uuid.uuid4())
        timestamp = now_iso()
        create_video(
            {
                "id": video_id,
                "document_id": document.id,
                "status": "queued",
                "stage": "queued",
                "progress": 0,
                "title": Path(document.filename).stem,
                "level": options.level,
                "language": options.language,
                "duration_minutes": options.duration_minutes,
                "style": options.style,
                "voice": options.voice,
                "created_at": timestamp,
                "updated_at": timestamp,
            }
        )

    worker = threading.Thread(
        target=_run_job,
        args=(video_id, document, options),
        name=f"video-{video_id[:8]}",
        daemon=True,
    )
    worker.start()
    return video_id


def _progress(video_id: str, stage: str, progress: int, **fields) -> None:
    update_video(
        video_id,
        status="processing",
        stage=stage,
        progress=max(0, min(100, progress)),
        updated_at=now_iso(),
        **fields,
    )


def _read_wav(path: Path) -> tuple[bytes, int, int, int]:
    with wave.open(str(path), "rb") as source:
        return (
            source.readframes(source.getnframes()),
            source.getframerate(),
            source.getnchannels(),
            source.getsampwidth(),
        )


def _format_timestamp(seconds: float) -> str:
    millis = int(round(seconds * 1000))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}.{millis:03d}"


def _captions(script: LessonScript, timings: list[tuple[float, float]]) -> str:
    """WebVTT captions. Scene boundaries are exact; sentence timing within a
    scene is estimated from sentence length."""
    cues = ["WEBVTT", ""]
    for scene, (start, speech_seconds) in zip(script.scenes, timings):
        sentences = [
            part.strip()
            for part in re.split(r"(?<=[.!?।؟])\s+", scene.narration)
            if part.strip()
        ]
        total_chars = sum(len(sentence) for sentence in sentences) or 1
        cursor = start
        for sentence in sentences:
            length = speech_seconds * len(sentence) / total_chars
            cues.append(f"{_format_timestamp(cursor)} --> {_format_timestamp(cursor + length)}")
            cues.append(sentence)
            cues.append("")
            cursor += length
    return "\n".join(cues)


def _run_job(video_id: str, document: DocumentRecord, options: VideoOptions) -> None:
    work_dir = VIDEO_WORK_DIR / video_id
    video_path = VIDEO_DIR / f"{video_id}.mp4"
    thumbnail_path = VIDEO_DIR / f"{video_id}.jpg"
    captions_path = VIDEO_DIR / f"{video_id}.vtt"
    succeeded = False

    try:
        work_dir.mkdir(parents=True, exist_ok=True)
        VIDEO_DIR.mkdir(parents=True, exist_ok=True)

        # 1. Script
        _progress(video_id, "script", 5)
        text = load_document_text(Path(document.stored_path), Path(document.extracted_path))
        script = generate_lesson_script(
            text,
            document.filename,
            LessonOptions(options.level, options.language, options.duration_minutes),
        )
        total = len(script.scenes)
        _progress(
            video_id,
            "narration",
            15,
            title=script.title,
            subject=script.subject,
            scene_count=total,
            script_json=script.model_dump_json(),
        )

        # 2. Narration (15% -> 70%)
        scene_audio: list[Path] = []
        for index, scene in enumerate(script.scenes):
            destination = work_dir / f"scene-{index:02d}.wav"
            tts_service.synthesize_narration(
                scene.narration, options.voice, destination=destination, wait=True
            )
            scene_audio.append(destination)
            _progress(video_id, "narration", 15 + int(55 * (index + 1) / total))

        # 3. Slides (70% -> 80%)
        _progress(video_id, "slides", 72)
        slide_paths: list[Path] = []
        for index, scene in enumerate(script.scenes):
            slide_paths.append(
                slide_service.render_slide(
                    destination=work_dir / f"slide-{index:02d}.png",
                    lesson_title=script.title,
                    subject=script.subject,
                    heading=scene.heading,
                    bullets=scene.bullets,
                    index=index,
                    total=total,
                    style=options.style,
                    language=options.language,
                )
            )
        slide_service.render_thumbnail(slide_paths[0], thumbnail_path)

        # 4. One continuous narration track with pauses between scenes, and
        #    slide durations that match it exactly.
        _progress(video_id, "assembling", 80)
        pcm_parts: list[bytes] = []
        slides: list[tuple[Path, float]] = []
        timings: list[tuple[float, float]] = []
        audio_format: tuple[int, int, int] | None = None
        elapsed = 0.0
        for index, (audio_path, slide_path) in enumerate(zip(scene_audio, slide_paths)):
            pcm, rate, channels, width = _read_wav(audio_path)
            if audio_format is None:
                audio_format = (rate, channels, width)
            elif audio_format != (rate, channels, width):
                raise VideoServiceError(
                    "audio_mismatch", "Scene narrations have different audio formats.", 500
                )
            frame_bytes = channels * width
            gap = FINAL_TAIL_SECONDS if index == total - 1 else SCENE_GAP_SECONDS
            silence = b"\x00" * (int(rate * gap) * frame_bytes)
            speech_seconds = len(pcm) / (rate * frame_bytes)
            scene_seconds = (len(pcm) + len(silence)) / (rate * frame_bytes)
            pcm_parts.append(pcm + silence)
            slides.append((slide_path, scene_seconds))
            timings.append((elapsed, speech_seconds))
            elapsed += scene_seconds

        assert audio_format is not None
        narration_path = work_dir / "narration.wav"
        with wave.open(str(narration_path), "wb") as output:
            output.setframerate(audio_format[0])
            output.setnchannels(audio_format[1])
            output.setsampwidth(audio_format[2])
            output.writeframes(b"".join(pcm_parts))

        captions_path.write_text(_captions(script, timings), encoding="utf-8")

        _progress(video_id, "assembling", 85)
        ffmpeg_service.assemble_video(slides, narration_path, video_path, work_dir)

        # 5. Verify the output before marking it ready.
        info = ffmpeg_service.probe(video_path)
        if info.video_codec != "h264" or info.audio_codec != "aac" or info.duration_seconds <= 0:
            raise VideoServiceError(
                "invalid_output",
                "The generated video failed verification. Please try again.",
                500,
            )

        timestamp = now_iso()
        update_video(
            video_id,
            status="ready",
            stage="done",
            progress=100,
            duration_seconds=round(info.duration_seconds, 2),
            size_bytes=video_path.stat().st_size,
            video_path=str(video_path),
            thumbnail_path=str(thumbnail_path),
            captions_path=str(captions_path),
            updated_at=timestamp,
            completed_at=timestamp,
        )
        succeeded = True
        logger.info("Video %s ready (%.1fs)", video_id, info.duration_seconds)

    except (
        VideoServiceError,
        GeminiServiceError,
        TtsServiceError,
        SlideServiceError,
        FfmpegError,
        PdfServiceError,
    ) as exc:
        logger.warning("Video %s failed: %s (%s)", video_id, exc.message, exc.code)
        _fail(video_id, exc.code, exc.message)
    except Exception:
        logger.exception("Video %s failed unexpectedly", video_id)
        _fail(video_id, "video_failed", "Video generation failed unexpectedly. Please try again.")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)
        if not succeeded:
            for path in (video_path, thumbnail_path, captions_path):
                path.unlink(missing_ok=True)


def _fail(video_id: str, code: str, message: str) -> None:
    try:
        update_video(
            video_id,
            status="failed",
            stage="failed",
            error_code=code,
            error_message=message,
            updated_at=now_iso(),
        )
    except Exception:
        logger.exception("Could not record failure for video %s", video_id)


def resolve_output(stored_path: str | None, suffix: str) -> Path | None:
    """Return a stored output only if it sits directly inside VIDEO_DIR."""
    if not stored_path:
        return None
    path = Path(stored_path).resolve()
    if path.parent != VIDEO_DIR.resolve() or path.suffix != suffix or not path.is_file():
        return None
    return path


def script_from_json(raw: str | None) -> LessonScript | None:
    if not raw:
        return None
    try:
        return LessonScript.model_validate(json.loads(raw))
    except (ValueError, TypeError):
        return None
