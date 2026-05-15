# ST-805C PR2: Scoring Engine Integration — Summary

**Ticket:** ST-805C  
**PR:** PR2 — Scoring Engine Integration  
**Branch:** `st-805c-pr2-scoring`  
**Date:** 2026-05-15  
**Author:** Mike (Lead Dev)

---

## Overview

This PR adds ball-centered coordination scoring to the Arc 1 grading engine, aligning the scoring layer with the ST-805 curriculum refactor. Two new metrics measure coordination (slip/skid ball centering) during climb and slow flight phases, using `slip_deg` from the existing V5 telemetry pipeline.

---

## Metrics Added

| Metric | Dataref | Tolerance | Lessons | Description |
|---|---|---|---|---|
| `ball_centered_climb` | `slip_deg` | ±3.0° | L2, L3, L4 | Measures coordination during climb phases. Evaluates right-rudder discipline to compensate for left-turning tendencies. |
| `ball_centered_slow_flight` | `slip_deg` | ±4.0° | L3 only | Measures coordination during slow flight. Looser tolerance due to reduced control effectiveness at high AoA. |

### Scoring Algorithm

Both metrics use the same algorithm:
1. Collect `|slip_deg|` samples from relevant flight phases (or fallback to VS/IAS-based detection)
2. Compute percentage of samples within tolerance threshold
3. Score = `1.0 + 4.0 × pctWithin`, with penalty for mean slip exceeding tolerance
4. Clamped to 1–5 scale, rounded to 2 decimal places

---

## Weight Distribution Per Lesson

| Lesson | Metric | `scoring_weight` (from lessons_v2.json) | Implementation |
|---|---|---|---|
| **L2** (Energy Management) | `ball_centered_climb` | 1 | Single `coordination_climb` phase |
| **L3** (Envelope Awareness) | `ball_centered_climb` | 1 | Single `coordination_climb` phase |
| **L3** (Envelope Awareness) | `ball_centered_slow_flight` | 1 | Single `coordination_slow_flight` phase |
| **L4** (Check Flight) | `ball_centered_climb` | 2 | Double-weight: `coordination_climb` + `coordination_climb_weight` phases |

### L4 Higher Weight Rationale
The check flight (L4) uses weight=2 per `lessons_v2.json` spec: "Check flight — higher weight than L2/L3." Implemented via two phase entries contributing to the overall score average.

---

## Files Changed

| File | Change | Risk |
|---|---|---|
| `lib/s2s-engine/constants.ts` | Added `BALL_CENTERED_CLIMB_TOLERANCE_DEG` (3.0) and `BALL_CENTERED_SLOW_FLIGHT_TOLERANCE_DEG` (4.0) | LOW |
| `lib/s2s-engine/arc1-grader.ts` | Added `scoreBallCenteredClimb()` and `scoreBallCenteredSlowFlight()` functions; integrated into `gradeL2()`, `gradeL3()`, `gradeL4()` | MEDIUM |
| `lib/s2s-engine/__tests__/ball-centered-scoring.test.ts` | New: 37 unit tests for scoring functions | NONE |
| `lib/s2s-engine/__tests__/integration-v5-scoring.test.ts` | New: 46 integration tests with real V5 CSV | NONE |

---

## Test Results

### Unit Tests (37/37 passed)
- Constants validation
- Perfect coordination → score 5
- Moderate slip within tolerance → score ≥4
- Heavy slip outside tolerance → score ≤2
- No data → null (backward compatible)
- On-ground samples filtered out
- Fallback detection (VS-based for climb, IAS-based for slow flight)
- Mixed slip distributions
- Negative slip values (absolute value used)
- Score range validation [1, 5] across all inputs

### Integration Tests (46/46 passed)
- Real V5 CSV: `s2s_telemetry_20260511_173825.csv` (19,614 lines)
- L1: No coordination metrics (correct — L1 has no ball_centered thresholds)
- L2: `ball_centered_climb` present, score=5, mean slip=0.7°, 326 samples, 100% within ±3°
- L3: Both metrics present — climb score=5 (326 samples), slow flight score=5 (88 samples)
- L4: Double-weight coordination_climb present, consistent scores across both entries
- Backward compatibility: All lessons produce valid LessonResult, JSON, and HTML output

---

## Path View Impact

**No change** to:
- Lesson order or unlock logic
- Student progression gating rules
- Pass/fail thresholds (still 1–5 scale, pass at ≥3)
- Existing metric scoring
- Quiz requirements

**Impact limited to:**
- More accurate evaluation of coordination during Arc 1 lessons
- New metrics appear in scoring output (phases array) for UI rendering
- Coaching bullets added when ball_centered scores < 3

---

## Backward Compatibility

- Lessons without climb/slow flight telemetry data grade correctly (metrics return `null`, no phase added)
- Existing Arc 1 evaluation flow unchanged — new metrics are additive only
- V4 telemetry still works (slip_deg column present in both V4 and V5 schemas)
- No changes to `LessonResult` interface, `MetricResult`, or `PhaseResult` types

---

## Next Steps

- **PR3:** UI component updates to render `ball_centered_climb` and `ball_centered_slow_flight` in debrief charts
- Pending merge of PR1 (schema + data plumbing on `st-805b-pr1-schema-data`)
