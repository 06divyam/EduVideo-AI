import logging

from google import genai
from google.genai import types

from config import GEMINI_API_KEY, GEMINI_MODEL, MAX_AI_SOURCE_CHARS
from schemas import GeneratedQuiz, StudyNotes

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


class GeminiServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _get_client() -> genai.Client:
    global _client

    if not GEMINI_API_KEY:
        raise GeminiServiceError(
            "gemini_not_configured",
            "Gemini is not configured on the backend. Add GEMINI_API_KEY to backend/.env.",
            status_code=503,
        )

    if _client is None:
        _client = genai.Client(api_key=GEMINI_API_KEY)

    return _client


def _source_text(text: str) -> str:
    cleaned = text.replace("\x00", " ").strip()
    if len(cleaned) > MAX_AI_SOURCE_CHARS:
        return cleaned[:MAX_AI_SOURCE_CHARS]
    return cleaned


def _generate_structured(prompt: str, schema: type) -> object:
    client = _get_client()

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=schema,
                temperature=0.35,
            ),
        )
    except Exception as exc:
        logger.exception("Gemini request failed")
        message = str(exc).lower()

        if "api key" in message or "unauthenticated" in message or "permission" in message:
            raise GeminiServiceError(
                "gemini_auth_error",
                "Gemini rejected the backend API key. Check GEMINI_API_KEY in backend/.env.",
                status_code=502,
            ) from exc

        if "quota" in message or "rate limit" in message or "429" in message:
            raise GeminiServiceError(
                "gemini_rate_limited",
                "Gemini rate limit reached. Wait a moment and try again.",
                status_code=429,
            ) from exc

        raise GeminiServiceError(
            "gemini_error",
            "Gemini could not generate a response. Please try again.",
        ) from exc

    if not response.text:
        raise GeminiServiceError(
            "gemini_empty_response",
            "Gemini returned an empty response. Please try again.",
        )

    try:
        return schema.model_validate_json(response.text)
    except Exception as exc:
        logger.warning("Gemini returned invalid structured output: %s", response.text[:500])
        raise GeminiServiceError(
            "gemini_invalid_response",
            "Gemini returned an unexpected response. Please try again.",
        ) from exc


def generate_study_notes(text: str, filename: str) -> StudyNotes:
    source = _source_text(text)
    if not source:
        raise GeminiServiceError(
            "empty_source",
            "The document has no extracted text to study.",
            status_code=422,
        )

    prompt = f"""You are an expert tutor creating smart study notes for a student.

Use ONLY the source material below. Do not invent facts that are not supported by the source.
Write in simple, clear English. Organize the material topic by topic.

Requirements:
- Give the notes a short descriptive title.
- Write a 2-3 sentence summary.
- Create one entry per major topic. For each topic include:
  - a simple explanation in plain English
  - important definitions (term + definition)
  - concrete examples grounded in the source
  - key points for quick review
- Finish with short revision notes (bullet-style takeaways).
- Cover all major ideas in the source, but do not pad with filler.

Source filename: {filename}

SOURCE MATERIAL:
\"\"\"
{source}
\"\"\"
"""
    notes = _generate_structured(prompt, StudyNotes)

    if not notes.title.strip() or not notes.summary.strip():
        raise GeminiServiceError(
            "gemini_invalid_response",
            "Gemini returned incomplete study notes. Please try again.",
        )

    for topic in notes.topics:
        if not topic.name.strip() or not topic.explanation.strip():
            raise GeminiServiceError(
                "gemini_invalid_response",
                "Gemini returned an incomplete topic. Please try again.",
            )

    return notes


def generate_quiz(
    text: str,
    filename: str,
    question_count: int,
    difficulty: str,
) -> GeneratedQuiz:
    source = _source_text(text)
    if not source:
        raise GeminiServiceError(
            "empty_source",
            "The document has no extracted text to quiz.",
            status_code=422,
        )

    if difficulty == "mixed":
        difficulty_rule = (
            "Use a mix of easy, medium, and hard questions, and label each one."
        )
    else:
        difficulty_rule = (
            f"Every question must have difficulty '{difficulty}'."
        )

    prompt = f"""You are an exam writer creating a multiple-choice quiz.

Use ONLY the source material below. Every question must be answerable from the source.
Do not invent facts. Do not put the answer in the question text.

Requirements:
- Create exactly {question_count} questions.
- Each question must have exactly 4 plausible options and exactly one correct option.
- answer_index is 0-based and must point to the correct option.
- Include a short explanation for why the correct answer is right.
- Assign each question a short topic label (2-5 words) drawn from the source.
- {difficulty_rule}
- Questions should test understanding, not trivia or wording recall.

Source filename: {filename}

SOURCE MATERIAL:
\"\"\"
{source}
\"\"\"
"""
    quiz = _generate_structured(prompt, GeneratedQuiz)

    if len(quiz.questions) != question_count:
        raise GeminiServiceError(
            "gemini_invalid_response",
            f"Gemini returned {len(quiz.questions)} questions instead of {question_count}. Please try again.",
        )

    for index, question in enumerate(quiz.questions, start=1):
        if not question.question.strip() or not question.explanation.strip():
            raise GeminiServiceError(
                "gemini_invalid_response",
                f"Question {index} is incomplete. Please try again.",
            )
        if len(question.options) != 4:
            raise GeminiServiceError(
                "gemini_invalid_response",
                f"Question {index} does not have exactly four options. Please try again.",
            )
        if len({option.strip().lower() for option in question.options}) != 4:
            raise GeminiServiceError(
                "gemini_invalid_response",
                f"Question {index} has duplicate options. Please try again.",
            )
        if not 0 <= question.answer_index < len(question.options):
            raise GeminiServiceError(
                "gemini_invalid_response",
                f"Question {index} has an invalid answer. Please try again.",
            )
        if not question.topic.strip():
            raise GeminiServiceError(
                "gemini_invalid_response",
                f"Question {index} is missing a topic. Please try again.",
            )

    return quiz
