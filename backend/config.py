import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "storage" / "uploads"
EXTRACTED_DIR = BASE_DIR / "storage" / "extracted"
AUDIO_DIR = BASE_DIR / "storage" / "audio"
VIDEO_DIR = BASE_DIR / "storage" / "videos"
VIDEO_WORK_DIR = BASE_DIR / "storage" / "tmp"

DATABASE_PATH = DATA_DIR / "eduvideo.db"

MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "20"))
MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

MIN_EXTRACTED_CHARS = int(os.getenv("MIN_EXTRACTED_CHARS", "20"))

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "").strip()
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
MAX_AI_SOURCE_CHARS = int(os.getenv("MAX_AI_SOURCE_CHARS", "24000"))

# Text-to-speech (verified against the API on 2026-10-31).
# TTS_PROVIDER selects the narration engine: "murf" (default) or "gemini".
# Gemini is still used for lesson scripts regardless of this setting.
TTS_PROVIDER = os.getenv("TTS_PROVIDER", "murf").strip().lower()
GEMINI_TTS_MODEL = os.getenv("GEMINI_TTS_MODEL", "gemini-3.8-flash-lite-tts").strip()
GEMINI_TTS_VOICE = os.getenv("GEMINI_TTS_VOICE", "Kore").strip()
TTS_TIMEOUT_SECONDS = int(os.getenv("TTS_TIMEOUT_SECONDS", "120"))

# Murf TTS (https://murf.ai/api/docs). MURF_VOICE_ID is the English voice;
# other lesson languages use built-in per-language defaults.
MURF_API_KEY = os.getenv("MURF_API_KEY", "").strip()
MURF_API_BASE_URL = os.getenv("MURF_API_BASE_URL", "https://api.murf.ai").strip().rstrip("/")
MURF_VOICE_ID = os.getenv("MURF_VOICE_ID", "en-US-natalie").strip()
MURF_STYLE = os.getenv("MURF_STYLE", "").strip()
MURF_SAMPLE_RATE = int(os.getenv("MURF_SAMPLE_RATE", "24000"))
# Murf documents a 3,000 character limit per request.
MURF_MAX_REQUEST_CHARS = int(os.getenv("MURF_MAX_REQUEST_CHARS", "3000"))
# Max narration accepted per request, and max sent to the model per call.
# Longer text is split at sentence boundaries and the audio is concatenated.
MAX_NARRATION_CHARS = int(os.getenv("MAX_NARRATION_CHARS", "5000"))
TTS_CHUNK_CHARS = int(os.getenv("TTS_CHUNK_CHARS", "1500"))
# Video narration: scenes are joined and voiced in as few requests as
# possible; each request carries at most this many characters (also capped
# by MAX_NARRATION_CHARS and the provider's own limit). Slide changes are
# found from pauses in the audio.
VIDEO_TTS_GROUP_CHARS = int(os.getenv("VIDEO_TTS_GROUP_CHARS", "5000"))

QUIZ_TIME_PER_QUESTION_SECONDS = int(
    os.getenv("QUIZ_TIME_PER_QUESTION_SECONDS", "60")
)
QUIZ_MIN_QUESTIONS = 5
QUIZ_MAX_QUESTIONS = 10

DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"


def cors_origins() -> list[str]:
    raw = os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)
    return [origin.strip() for origin in raw.split(",") if origin.strip()]


def ensure_directories() -> None:
    for directory in (
        DATA_DIR, UPLOAD_DIR, EXTRACTED_DIR, AUDIO_DIR, VIDEO_DIR, VIDEO_WORK_DIR,
    ):
        directory.mkdir(parents=True, exist_ok=True)
