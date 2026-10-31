"""Slide rendering for lesson videos (Pillow).

Renders one 16:9 PNG per lesson scene in one of three styles that match the
Create Video form: "illustrated", "classroom", and "minimal". Text is
wrapped and shrunk to fit, so any script produces a readable slide.

All styles share the app's neutral palette (same values as the frontend
tokens in src/app/globals.css): light backgrounds, charcoal text, grey
borders, and one muted slate-blue accent. Styles differ only in a single
quiet decoration, so slides stay readable in the final MP4.

Latin-script languages render with standard system fonts. Devanagari (Hindi)
and Arabic need complex text shaping, which Pillow only provides when
libraqm is installed; without it those languages are rejected up front
rather than rendered with broken glyphs.
"""

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, features

SLIDE_WIDTH = 1280
SLIDE_HEIGHT = 720
THUMBNAIL_SIZE = (640, 360)

LATIN_LANGUAGES = {"English", "Spanish", "French", "Portuguese"}
COMPLEX_SCRIPT_FONTS = {
    "Hindi": [
        "/System/Library/Fonts/Kohinoor.ttc",
        "/System/Library/Fonts/Supplemental/ITFDevanagari.ttc",
        "/System/Library/Fonts/Supplemental/DevanagariMT.ttc",
    ],
    "Arabic": [
        "/System/Library/Fonts/SFArabic.ttf",
        "/System/Library/Fonts/GeezaPro.ttc",
    ],
}
RTL_LANGUAGES = {"Arabic"}

REGULAR_FONTS = [
    os.getenv("SLIDE_FONT_REGULAR", ""),
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/Library/Fonts/Arial.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
]
BOLD_FONTS = [
    os.getenv("SLIDE_FONT_BOLD", ""),
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/Library/Fonts/Arial Bold.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


class SlideServiceError(Exception):
    def __init__(self, code: str, message: str, status_code: int = 500) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


# Palette shared with the frontend design tokens (RGB).
OFF_WHITE = (247, 247, 248)  # page background  #f7f7f8
WHITE = (255, 255, 255)
CHARCOAL = (28, 32, 36)  # headings          #1c2024
BODY = (55, 62, 71)  # body text          #373e47
MUTED = (100, 108, 120)  # secondary text     #646c78
BORDER = (226, 232, 240)  # dividers/tracks    #e2e8f0
BRAND_50 = (242, 245, 249)
BRAND_100 = (227, 233, 241)
BRAND_600 = (64, 92, 127)  # accent             #405c7f
BRAND_700 = (53, 75, 104)


@dataclass(frozen=True)
class Theme:
    background_top: tuple[int, int, int]
    background_bottom: tuple[int, int, int]
    heading: tuple[int, int, int]
    body: tuple[int, int, int]
    muted: tuple[int, int, int]
    accent: tuple[int, int, int]
    chip_fill: tuple[int, int, int, int]
    chip_text: tuple[int, int, int]
    track: tuple[int, int, int, int]
    decoration: str  # "shapes" | "board" | "bar"


THEMES = {
    # Off-white with one large, very pale accent circle.
    "illustrated": Theme(
        background_top=OFF_WHITE,
        background_bottom=OFF_WHITE,
        heading=CHARCOAL,
        body=BODY,
        muted=MUTED,
        accent=BRAND_600,
        chip_fill=(*BRAND_100, 255),
        chip_text=BRAND_700,
        track=(*BORDER, 255),
        decoration="shapes",
    ),
    # White "whiteboard" with a thin grey frame.
    "classroom": Theme(
        background_top=WHITE,
        background_bottom=WHITE,
        heading=CHARCOAL,
        body=BODY,
        muted=MUTED,
        accent=BRAND_600,
        chip_fill=(241, 243, 245, 255),
        chip_text=BODY,
        track=(*BORDER, 255),
        decoration="board",
    ),
    # Plain white with an accent bar on the leading edge.
    "minimal": Theme(
        background_top=WHITE,
        background_bottom=WHITE,
        heading=CHARCOAL,
        body=BODY,
        muted=MUTED,
        accent=BRAND_600,
        chip_fill=(*BRAND_50, 255),
        chip_text=BRAND_700,
        track=(*BORDER, 255),
        decoration="bar",
    ),
}


def raqm_available() -> bool:
    return bool(features.check("raqm"))


def check_language_supported(language: str) -> None:
    """Raise if slides in this language cannot be rendered correctly."""
    if language in LATIN_LANGUAGES:
        return

    if language in COMPLEX_SCRIPT_FONTS:
        if not raqm_available():
            raise SlideServiceError(
                "language_not_supported",
                f"{language} slides need complex text shaping (libraqm), which "
                "is not installed on this server. Choose English, Spanish, "
                "French, or Portuguese, or install libraqm.",
                status_code=422,
            )
        if _first_existing(COMPLEX_SCRIPT_FONTS[language]) is None:
            raise SlideServiceError(
                "language_not_supported",
                f"No font with {language} support was found on this server.",
                status_code=422,
            )
        return

    raise SlideServiceError(
        "language_not_supported",
        f"Unsupported lesson language '{language}'.",
        status_code=422,
    )


def _first_existing(paths: list[str]) -> str | None:
    return next((path for path in paths if path and Path(path).is_file()), None)


@lru_cache(maxsize=64)
def _font(bold: bool, size: int, language: str) -> ImageFont.FreeTypeFont:
    if language in COMPLEX_SCRIPT_FONTS:
        path = _first_existing(COMPLEX_SCRIPT_FONTS[language])
        if path:
            return ImageFont.truetype(
                path, size, layout_engine=ImageFont.Layout.RAQM
            )

    path = _first_existing(BOLD_FONTS if bold else REGULAR_FONTS)
    if path:
        return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def _wrap(text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    lines: list[str] = []
    current = ""
    for word in text.split():
        candidate = f"{current} {word}".strip()
        if font.getlength(candidate) <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def _gradient(theme: Theme) -> Image.Image:
    if theme.background_top == theme.background_bottom:
        return Image.new("RGB", (SLIDE_WIDTH, SLIDE_HEIGHT), theme.background_top)
    top = Image.new("RGB", (SLIDE_WIDTH, SLIDE_HEIGHT), theme.background_top)
    bottom = Image.new("RGB", (SLIDE_WIDTH, SLIDE_HEIGHT), theme.background_bottom)
    mask = Image.linear_gradient("L").resize((SLIDE_WIDTH, SLIDE_HEIGHT))
    return Image.composite(bottom, top, mask)


def _decorate(image: Image.Image, theme: Theme) -> None:
    overlay = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    if theme.decoration == "shapes":
        # One soft circle bleeding off the top-right corner, kept well clear
        # of the text column.
        draw.ellipse((1010, -190, 1450, 250), fill=(*BRAND_50, 255))
        draw.ellipse((1010, -190, 1450, 250), outline=(*BRAND_100, 255), width=2)
    elif theme.decoration == "board":
        draw.rectangle((16, 16, SLIDE_WIDTH - 17, SLIDE_HEIGHT - 17), outline=(*BORDER, 255), width=2)
    elif theme.decoration == "bar":
        draw.rectangle((0, 0, 10, SLIDE_HEIGHT), fill=(*theme.accent, 255))

    image.paste(overlay, (0, 0), overlay)


def render_slide(
    *,
    destination: Path,
    lesson_title: str,
    subject: str,
    heading: str,
    bullets: list[str],
    index: int,
    total: int,
    style: str = "illustrated",
    language: str = "English",
) -> Path:
    theme = THEMES.get(style)
    if theme is None:
        raise SlideServiceError("invalid_style", f"Unknown slide style '{style}'.", 422)

    rtl = language in RTL_LANGUAGES
    direction = "rtl" if rtl else None
    image = _gradient(theme)
    _decorate(image, theme)
    draw = ImageDraw.Draw(image, "RGBA")

    margin_x = 96
    content_width = SLIDE_WIDTH - margin_x * 2
    is_intro = index == 0

    def x_for(text: str, font: ImageFont.FreeTypeFont) -> int:
        if not rtl:
            return margin_x
        return int(SLIDE_WIDTH - margin_x - font.getlength(text, direction="rtl"))

    # Subject chip.
    chip_font = _font(True, 20, language)
    chip_text = subject.upper() if not rtl and language in LATIN_LANGUAGES else subject
    chip_width = int(chip_font.getlength(chip_text)) + 32
    chip_x = margin_x if not rtl else SLIDE_WIDTH - margin_x - chip_width
    draw.rounded_rectangle((chip_x, 64, chip_x + chip_width, 102), radius=10, fill=theme.chip_fill)
    draw.text((chip_x + 16, 72), chip_text, font=chip_font, fill=theme.chip_text, direction=direction)

    y = 140
    if is_intro:
        # Intro slide: large lesson title, then the first scene heading.
        for size in (64, 56, 48, 42):
            title_font = _font(True, size, language)
            title_lines = _wrap(lesson_title, title_font, content_width)
            if len(title_lines) <= 2:
                break
        for line in title_lines[:2]:
            draw.text((x_for(line, title_font), y), line, font=title_font, fill=theme.heading, direction=direction)
            y += int(title_font.size * 1.18)
        y += 14
        sub_font = _font(False, 30, language)
        draw.text((x_for(heading, sub_font), y), heading, font=sub_font, fill=theme.muted, direction=direction)
        y += 66
    else:
        for size in (54, 48, 42, 36):
            heading_font = _font(True, size, language)
            heading_lines = _wrap(heading, heading_font, content_width)
            if len(heading_lines) <= 2:
                break
        for line in heading_lines[:2]:
            draw.text((x_for(line, heading_font), y), line, font=heading_font, fill=theme.heading, direction=direction)
            y += int(heading_font.size * 1.2)
        y += 10
        underline_x = margin_x if not rtl else SLIDE_WIDTH - margin_x - 96
        draw.rounded_rectangle((underline_x, y, underline_x + 96, y + 6), radius=3, fill=(*theme.accent, 255))
        y += 44

    # Bullets: shrink until they fit above the footer.
    footer_top = SLIDE_HEIGHT - 110
    bullet_indent = 40
    for size in (34, 31, 28, 25, 22):
        body_font = _font(False, size, language)
        line_height = int(size * 1.35)
        wrapped = [_wrap(bullet, body_font, content_width - bullet_indent) for bullet in bullets]
        needed = sum(len(lines) * line_height + int(size * 0.6) for lines in wrapped)
        if y + needed <= footer_top:
            break

    for lines in wrapped:
        if y + line_height > footer_top:
            break
        dot_y = y + int(body_font.size * 0.55)
        dot_x = margin_x + 6 if not rtl else SLIDE_WIDTH - margin_x - 18
        draw.ellipse((dot_x, dot_y - 6, dot_x + 12, dot_y + 6), fill=(*theme.accent, 255))
        for line in lines:
            if y + line_height > footer_top:
                break
            text_x = margin_x + bullet_indent if not rtl else int(
                SLIDE_WIDTH - margin_x - bullet_indent - body_font.getlength(line, direction="rtl")
            )
            draw.text((text_x, y), line, font=body_font, fill=theme.body, direction=direction)
            y += line_height
        y += int(body_font.size * 0.6)

    # Footer: lesson title, progress track, scene counter.
    footer_font = _font(False, 20, language)
    footer_y = SLIDE_HEIGHT - 70
    title_text = lesson_title
    while footer_font.getlength(title_text) > content_width * 0.6 and len(title_text) > 4:
        title_text = title_text.removesuffix("…")[:-1].rstrip() + "…"
    counter = f"{index + 1} / {total}"
    if rtl:
        draw.text((x_for(title_text, footer_font), footer_y), title_text, font=footer_font, fill=theme.muted, direction=direction)
        draw.text((margin_x, footer_y), counter, font=footer_font, fill=theme.muted)
    else:
        draw.text((margin_x, footer_y), title_text, font=footer_font, fill=theme.muted)
        counter_x = SLIDE_WIDTH - margin_x - int(footer_font.getlength(counter))
        draw.text((counter_x, footer_y), counter, font=footer_font, fill=theme.muted)

    track_y = SLIDE_HEIGHT - 30
    draw.rounded_rectangle((margin_x, track_y, SLIDE_WIDTH - margin_x, track_y + 6), radius=3, fill=theme.track)
    filled = int(content_width * (index + 1) / max(total, 1))
    if rtl:
        draw.rounded_rectangle((SLIDE_WIDTH - margin_x - filled, track_y, SLIDE_WIDTH - margin_x, track_y + 6), radius=3, fill=(*theme.accent, 255))
    else:
        draw.rounded_rectangle((margin_x, track_y, margin_x + filled, track_y + 6), radius=3, fill=(*theme.accent, 255))

    destination.parent.mkdir(parents=True, exist_ok=True)
    try:
        image.save(destination, "PNG", optimize=False)
    except OSError as exc:
        raise SlideServiceError("storage_error", "A slide could not be saved.") from exc
    return destination


def render_thumbnail(slide_path: Path, destination: Path) -> Path:
    with Image.open(slide_path) as slide:
        thumbnail = slide.convert("RGB").resize(THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
    temp = destination.with_name(f".{destination.name}.tmp")
    thumbnail.save(temp, "JPEG", quality=85)
    os.replace(temp, destination)
    return destination
