"""Slide rendering. Run: .venv/bin/python -m unittest discover -s tests -t ."""

import colorsys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

from services import slide_service
from services.slide_service import THEMES, SlideServiceError, render_slide, render_thumbnail


def is_purple(rgb: tuple[int, int, int]) -> bool:
    """Saturated colours with a hue in the violet/purple/magenta range."""
    h, _l, s = colorsys.rgb_to_hls(*(c / 255 for c in rgb))
    return s > 0.25 and 0.70 <= h <= 0.92


class ThemePaletteTests(unittest.TestCase):
    def test_all_styles_present(self):
        self.assertEqual(set(THEMES), {"illustrated", "classroom", "minimal"})

    def test_no_purple_and_shared_palette(self):
        for name, theme in THEMES.items():
            with self.subTest(style=name):
                colours = [
                    theme.background_top, theme.background_bottom, theme.heading,
                    theme.body, theme.muted, theme.accent, theme.chip_text,
                    theme.chip_fill[:3], theme.track[:3],
                ]
                self.assertFalse([c for c in colours if is_purple(c)])
                self.assertEqual(theme.accent, slide_service.BRAND_600)
                self.assertEqual(theme.heading, slide_service.CHARCOAL)
                # Light backgrounds only.
                self.assertGreater(min(theme.background_top), 240)
                self.assertEqual(theme.background_top, theme.background_bottom)


class RenderTests(unittest.TestCase):
    def render(self, style: str, index: int, directory: Path) -> Image.Image:
        path = render_slide(
            destination=directory / f"{style}-{index}.png",
            lesson_title="How Plants Make Food With Light",
            subject="Biology",
            heading="The Second Stage Makes Sugar",
            bullets=["Calvin cycle happens in the stroma", "Carbon dioxide becomes sugar " * 4],
            index=index,
            total=4,
            style=style,
        )
        return Image.open(path).convert("RGB")

    def test_every_style_renders_16_9_without_purple_pixels(self):
        with tempfile.TemporaryDirectory() as tmp:
            for style in THEMES:
                for index in (0, 2):
                    with self.subTest(style=style, index=index):
                        image = self.render(style, index, Path(tmp))
                        self.assertEqual(image.size, (1280, 720))
                        colours = image.getcolors(maxcolors=1 << 20) or []
                        purple = sum(n for n, c in colours if is_purple(c))
                        self.assertLess(purple / (1280 * 720), 0.001)
                        # Text is drawn: dark charcoal pixels exist.
                        self.assertTrue(any(max(c) < 60 for _, c in colours))

    def test_thumbnail(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.render("minimal", 0, Path(tmp))
            thumb = render_thumbnail(Path(tmp) / "minimal-0.png", Path(tmp) / "t.jpg")
            self.assertEqual(Image.open(thumb).size, slide_service.THUMBNAIL_SIZE)

    def test_unknown_style_rejected(self):
        with tempfile.TemporaryDirectory() as tmp, self.assertRaises(SlideServiceError):
            self.render("neon", 0, Path(tmp))


if __name__ == "__main__":
    unittest.main()
