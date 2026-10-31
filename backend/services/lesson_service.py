"""Lesson script generation for narrated explainer videos.

Turns extracted PDF text into a scene-by-scene script with Gemini. Each
scene has a short on-screen heading, a few bullet points for the slide, and
the narration that the TTS service will voice. Nothing here renders slides
or audio; see slide_service, tts_service, and video_service.
"""

import logging
from dataclasses import dataclass

from config import MAX_NARRATION_CHARS
from schemas import LessonScript
from services.gemini_service import (
    GeminiServiceError,
    _source_text,
    generate_structured,
)

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 2
MAX_HEADING_CHARS = 80
MAX_BULLET_CHARS = 140

LEVEL_GUIDANCE = {
    "beginner": (
        "The learner is a beginner. Use plain, friendly language, define every "
        "technical term the first time it appears, and use everyday analogies."
    ),
    "college": (
        "The learner is a college student with introductory knowledge. Use "
        "correct terminology and explain mechanisms and relationships."
    ),
    "exam": (
        "The learner is preparing for an exam. Focus on testable facts, "
        "definitions, processes, and common mistakes. Be precise and concise."
    ),
}

# minutes -> (scene count, approx narration words per scene)
DURATION_PLAN = {
    2: (4, 75),
    5: (7, 105),
    8: (10, 115),
}


@dataclass(frozen=True)
class LessonOptions:
    level: str = "beginner"
    language: str = "English"
    duration_minutes: int = 5


def _build_prompt(text: str, filename: str, options: LessonOptions) -> str:
    scene_count, words = DURATION_PLAN[options.duration_minutes]

    return f"""You are an expert teacher writing a narrated explainer video lesson.

Use ONLY the source material below. Do not invent facts that are not supported by the source.
{LEVEL_GUIDANCE[options.level]}

Write everything (title, subject, summary, headings, bullets, narration) in {options.language}.

Structure:
- title: a short, specific lesson title (max 8 words).
- subject: the academic subject in 1-3 words (for example "Biology").
- summary: 1-2 sentences describing what the lesson covers.
- scenes: exactly {scene_count} scenes, in teaching order.
  - Scene 1 introduces the topic and what the learner will learn.
  - Middle scenes each teach one idea from the source.
  - The final scene recaps the key takeaways.

For each scene:
- heading: a short slide heading (max 7 words).
- bullets: 2-4 short on-screen bullet points (max 12 words each). Bullets are
  slide text, not full sentences of the narration.
- narration: what the narrator says aloud, about {words} words, in a warm,
  clear teaching voice. Speak directly to the learner. Do not mention slides,
  bullet points, or "this video". Do not use markdown, emojis, or lists.
  Spell out symbols and abbreviations the first time they are spoken.

Source filename: {filename}

SOURCE MATERIAL:
\"\"\"
{text}
\"\"\"
"""


def _validate(script: LessonScript, expected_scenes: int) -> None:
    def invalid(message: str) -> GeminiServiceError:
        return GeminiServiceError("gemini_invalid_response", message)

    if not script.title.strip():
        raise invalid("Gemini returned a lesson without a title.")

    low, high = max(3, expected_scenes - 1), expected_scenes + 1
    if not low <= len(script.scenes) <= high:
        raise invalid(
            f"Gemini returned {len(script.scenes)} scenes instead of {expected_scenes}."
        )

    for index, scene in enumerate(script.scenes, start=1):
        narration = scene.narration.strip()
        if not scene.heading.strip() or len(narration) < 20:
            raise invalid(f"Scene {index} is incomplete.")
        if len(narration) > MAX_NARRATION_CHARS:
            raise invalid(f"Scene {index} narration is too long.")
        if not any(bullet.strip() for bullet in scene.bullets):
            raise invalid(f"Scene {index} has no slide bullets.")


def _tidy(script: LessonScript) -> LessonScript:
    """Trim whitespace and clamp slide text so it always fits a slide."""

    def clamp(value: str, limit: int) -> str:
        value = " ".join(value.split())
        return value if len(value) <= limit else value[: limit - 1].rstrip() + "…"

    for scene in script.scenes:
        scene.heading = clamp(scene.heading, MAX_HEADING_CHARS)
        scene.bullets = [
            clamp(bullet, MAX_BULLET_CHARS)
            for bullet in scene.bullets
            if bullet.strip()
        ][:4]
        scene.narration = " ".join(scene.narration.split())

    script.title = clamp(script.title, 90)
    script.subject = clamp(script.subject, 40) or "Lesson"
    script.summary = " ".join(script.summary.split())
    return script


def generate_lesson_script(
    text: str, filename: str, options: LessonOptions
) -> LessonScript:
    if options.level not in LEVEL_GUIDANCE:
        raise GeminiServiceError(
            "invalid_option", "Unknown learning level.", status_code=422
        )
    if options.duration_minutes not in DURATION_PLAN:
        raise GeminiServiceError(
            "invalid_option", "Unsupported video duration.", status_code=422
        )

    source = _source_text(text)
    if not source:
        raise GeminiServiceError(
            "empty_source",
            "The document has no extracted text to teach from.",
            status_code=422,
        )

    expected = DURATION_PLAN[options.duration_minutes][0]
    prompt = _build_prompt(source, filename, options)

    last_error: GeminiServiceError | None = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            script = generate_structured(prompt, LessonScript)
            _validate(script, expected)
            return _tidy(script)
        except GeminiServiceError as exc:
            # Only malformed output is worth retrying; auth/quota errors are not.
            if exc.code != "gemini_invalid_response":
                raise
            logger.warning("Lesson script attempt %d invalid: %s", attempt, exc.message)
            last_error = exc

    assert last_error is not None
    raise GeminiServiceError(
        "gemini_invalid_response",
        f"{last_error.message} Please try again.",
    )
