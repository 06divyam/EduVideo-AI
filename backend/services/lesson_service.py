"""Lesson generation placeholder.

Gemini lesson generation is intentionally not implemented in Phase 2. This
module exists so the pipeline can grow without coupling to the PDF extractor.
"""


class LessonGenerationUnavailable(RuntimeError):
    """Raised when lesson generation is requested before it is implemented."""

    def __init__(self) -> None:
        super().__init__("Lesson generation is not connected yet.")
