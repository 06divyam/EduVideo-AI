"""Align slide transitions with one continuous narration.

The whole lesson (or a group of scenes) is voiced by a single TTS request,
so we do not know exactly when each scene starts. We estimate it:

1. Expected boundary = where the scene's text starts within the narration,
   proportional to character count, mapped onto the speech portion of the
   audio (leading/trailing silence excluded).
2. Snap each boundary to a detected pause, choosing an ordered set of pauses
   that minimises distance from the expected times while preferring longer
   pauses (sentence and paragraph breaks are longer than comma pauses).

If there are not enough pauses, the remaining boundaries fall back to the
proportional estimate and are flagged as not snapped.
"""

from dataclasses import dataclass

# How strongly a longer pause attracts a boundary: one extra second of pause
# is worth this many seconds of distance from the expected time.
LONG_PAUSE_WEIGHT = 2.5
MAX_PAUSE_CREDIT_SECONDS = 1.2
EDGE_TOLERANCE_SECONDS = 0.05
# silencedetect can report one pause as several back-to-back intervals
# (e.g. 72.91-73.29 and 73.29-73.49). Gaps this small are merged so the pause
# is scored by its real length.
MERGE_GAP_SECONDS = 0.05


@dataclass(frozen=True)
class Silence:
    start: float
    end: float

    @property
    def duration(self) -> float:
        return self.end - self.start

    @property
    def midpoint(self) -> float:
        return (self.start + self.end) / 2


@dataclass(frozen=True)
class Boundary:
    time: float          # chosen transition time (seconds)
    expected: float      # proportional estimate before snapping
    snapped: bool        # True if placed inside a detected pause
    pause_seconds: float  # length of the pause used (0 if not snapped)


def merge_adjacent(silences: list[Silence], max_gap: float = MERGE_GAP_SECONDS) -> list[Silence]:
    merged: list[Silence] = []
    for silence in sorted(silences, key=lambda s: s.start):
        if merged and silence.start - merged[-1].end <= max_gap:
            merged[-1] = Silence(merged[-1].start, max(merged[-1].end, silence.end))
        else:
            merged.append(silence)
    return merged


def speech_span(silences: list[Silence], total: float) -> tuple[float, float]:
    start, end = 0.0, total
    if silences and silences[0].start <= EDGE_TOLERANCE_SECONDS:
        start = silences[0].end
    if silences and silences[-1].end >= total - EDGE_TOLERANCE_SECONDS:
        end = silences[-1].start
    return start, max(end, start)


def expected_boundaries(
    scene_lengths: list[int], speech_start: float, speech_end: float
) -> list[float]:
    total_chars = sum(scene_lengths) or 1
    span = speech_end - speech_start
    times, cumulative = [], 0
    for length in scene_lengths[:-1]:
        cumulative += length
        times.append(speech_start + span * cumulative / total_chars)
    return times


def align_boundaries(
    scene_lengths: list[int], silences: list[Silence], total: float
) -> list[Boundary]:
    """Return len(scene_lengths) - 1 ordered transition times."""
    needed = len(scene_lengths) - 1
    if needed <= 0:
        return []

    silences = merge_adjacent(silences)
    start, end = speech_span(silences, total)
    expected = expected_boundaries(scene_lengths, start, end)
    pauses = [s for s in silences if s.start > start and s.end < end]

    if len(pauses) < needed:
        return _greedy(expected, pauses)

    def cost(j: int, i: int) -> float:
        pause = pauses[i]
        credit = min(pause.duration, MAX_PAUSE_CREDIT_SECONDS) * LONG_PAUSE_WEIGHT
        return abs(pause.midpoint - expected[j]) - credit

    # Ordered assignment: boundary j uses pause i, with strictly increasing i.
    n = len(pauses)
    inf = float("inf")
    best = [[inf] * n for _ in range(needed)]
    back = [[-1] * n for _ in range(needed)]
    for i in range(n):
        best[0][i] = cost(0, i)
    for j in range(1, needed):
        running, running_index = inf, -1
        for i in range(n):
            if i > 0 and best[j - 1][i - 1] < running:
                running, running_index = best[j - 1][i - 1], i - 1
            if running_index >= 0:
                best[j][i] = running + cost(j, i)
                back[j][i] = running_index

    last = min(range(n), key=lambda i: best[needed - 1][i])
    chosen = [last]
    for j in range(needed - 1, 0, -1):
        chosen.append(back[j][chosen[-1]])
    chosen.reverse()

    return [
        Boundary(
            time=pauses[i].midpoint,
            expected=expected[j],
            snapped=True,
            pause_seconds=pauses[i].duration,
        )
        for j, i in enumerate(chosen)
    ]


def _greedy(expected: list[float], pauses: list[Silence]) -> list[Boundary]:
    """Few pauses: snap each estimate to the nearest unused later pause when
    it is reasonably close, otherwise keep the estimate."""
    results: list[Boundary] = []
    floor = -1.0
    available = list(pauses)
    for time in expected:
        candidates = [p for p in available if p.midpoint > floor]
        pick = min(candidates, key=lambda p: abs(p.midpoint - time), default=None)
        if pick is not None and abs(pick.midpoint - time) <= 3.0:
            available.remove(pick)
            results.append(Boundary(pick.midpoint, time, True, pick.duration))
            floor = pick.midpoint
        else:
            chosen = max(time, floor + 0.5)
            results.append(Boundary(chosen, time, False, 0.0))
            floor = chosen
    return results
