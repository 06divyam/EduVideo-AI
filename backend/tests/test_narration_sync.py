"""Slide boundary alignment. Run: .venv/bin/python -m unittest discover -s tests -t ."""

import unittest

from services.narration_sync import Silence, align_boundaries, merge_adjacent


class MergeAdjacentTests(unittest.TestCase):
    def test_back_to_back_fragments_merge(self):
        merged = merge_adjacent([Silence(73.293, 73.493), Silence(72.912, 73.292)])
        self.assertEqual(merged, [Silence(72.912, 73.493)])

    def test_separate_pauses_kept(self):
        pauses = [Silence(1.0, 1.3), Silence(2.0, 2.4)]
        self.assertEqual(merge_adjacent(pauses), pauses)


class AlignBoundariesTests(unittest.TestCase):
    def test_fragmented_scene_pause_beats_nearby_comma_pause(self):
        # Pattern seen in real Murf audio: the scene break pause (72.91-73.49)
        # was reported in two pieces, and a slightly longer comma pause sits
        # later. Expected boundary ~74s.
        silences = [
            Silence(0.0, 0.2),
            Silence(23.07, 23.64),
            Silence(47.98, 48.55),
            Silence(72.912, 73.292),
            Silence(73.293, 73.493),
            Silence(74.829, 75.419),
            Silence(97.6, 97.98),
        ]
        boundaries = align_boundaries([391, 432, 410, 395], silences, 97.98)
        self.assertTrue(all(b.snapped for b in boundaries))
        self.assertTrue(72.9 <= boundaries[2].time <= 73.5, boundaries[2])

    def test_single_scene_has_no_boundaries(self):
        self.assertEqual(align_boundaries([100], [Silence(1, 2)], 5.0), [])


if __name__ == "__main__":
    unittest.main()
