"""FFmpeg assembly for lesson videos.

Combines a sequence of still slides (each shown for an exact duration) with
one continuous narration WAV into an H.264/AAC MP4 that browsers can play
and seek. Building one audio track and timing slides to it keeps audio and
visuals in sync without per-scene re-encoding.
"""

import json
import logging
import os
import shutil
import subprocess
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)

VIDEO_FPS = 24
ASSEMBLY_TIMEOUT_SECONDS = int(os.getenv("FFMPEG_TIMEOUT_SECONDS", "900"))
SEARCH_DIRS = ("/opt/homebrew/bin", "/usr/local/bin", "/usr/bin")


class FfmpegError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class ProbeResult:
    duration_seconds: float
    video_codec: str | None
    audio_codec: str | None
    width: int | None
    height: int | None


def _find(binary: str, env_var: str) -> str | None:
    override = os.getenv(env_var, "").strip()
    if override:
        return override if Path(override).is_file() else None

    found = shutil.which(binary)
    if found:
        return found

    for directory in SEARCH_DIRS:
        candidate = Path(directory) / binary
        if candidate.is_file():
            return str(candidate)
    return None


def ffmpeg_path() -> str | None:
    return _find("ffmpeg", "FFMPEG_PATH")


def ffprobe_path() -> str | None:
    return _find("ffprobe", "FFPROBE_PATH")


def is_available() -> bool:
    return ffmpeg_path() is not None and ffprobe_path() is not None


def require_available() -> tuple[str, str]:
    ffmpeg, ffprobe = ffmpeg_path(), ffprobe_path()
    if not ffmpeg or not ffprobe:
        raise FfmpegError(
            "ffmpeg_not_installed",
            "FFmpeg is not available on the backend. Install it (brew install ffmpeg) and restart the server.",
            status_code=503,
        )
    return ffmpeg, ffprobe


def _quote(path: Path) -> str:
    # ffconcat single-quoted string; escape embedded single quotes.
    return "'" + str(path).replace("'", "'\\''") + "'"


def assemble_video(
    slides: list[tuple[Path, float]],
    narration_wav: Path,
    destination: Path,
    work_dir: Path,
) -> None:
    """Render ``slides`` (path, seconds) over ``narration_wav`` to an MP4."""
    ffmpeg, _ = require_available()

    if not slides:
        raise FfmpegError("ffmpeg_failed", "There are no slides to assemble.")

    concat_file = work_dir / "slides.ffconcat"
    lines = ["ffconcat version 1.0"]
    for path, seconds in slides:
        lines.append(f"file {_quote(path)}")
        lines.append(f"duration {seconds:.3f}")
    # The concat demuxer ignores the final duration unless the last file is
    # listed again.
    lines.append(f"file {_quote(slides[-1][0])}")
    concat_file.write_text("\n".join(lines) + "\n", encoding="utf-8")

    temp_output = destination.with_name(f".{destination.stem}.tmp.mp4")
    command = [
        ffmpeg, "-hide_banner", "-nostdin", "-y",
        "-loglevel", "error",
        "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-i", str(narration_wav),
        "-map", "0:v:0", "-map", "1:a:0",
        "-vf", f"fps={VIDEO_FPS},format=yuv420p",
        "-c:v", "libx264", "-preset", "veryfast", "-tune", "stillimage", "-crf", "22",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "1",
        "-movflags", "+faststart",
        # Exact length of the narration track. (-shortest overshoots by up to
        # a slide when the video goes through a filter graph.)
        "-t", f"{sum(seconds for _, seconds in slides):.3f}",
        str(temp_output),
    ]

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=ASSEMBLY_TIMEOUT_SECONDS,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        temp_output.unlink(missing_ok=True)
        raise FfmpegError(
            "ffmpeg_timeout", "Video assembly took too long and was stopped."
        ) from exc

    if result.returncode != 0 or not temp_output.is_file():
        temp_output.unlink(missing_ok=True)
        logger.error("ffmpeg failed (%s): %s", result.returncode, result.stderr[-2000:])
        raise FfmpegError("ffmpeg_failed", "FFmpeg could not assemble the video.")

    os.replace(temp_output, destination)


def probe(path: Path) -> ProbeResult:
    _, ffprobe = require_available()
    result = subprocess.run(
        [
            ffprobe, "-v", "error",
            "-show_entries", "format=duration:stream=codec_type,codec_name,width,height",
            "-of", "json", str(path),
        ],
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )
    if result.returncode != 0:
        raise FfmpegError("ffprobe_failed", "The generated video could not be inspected.")

    data = json.loads(result.stdout or "{}")
    streams = data.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    audio = next((s for s in streams if s.get("codec_type") == "audio"), {})

    return ProbeResult(
        duration_seconds=float(data.get("format", {}).get("duration") or 0.0),
        video_codec=video.get("codec_name"),
        audio_codec=audio.get("codec_name"),
        width=video.get("width"),
        height=video.get("height"),
    )
