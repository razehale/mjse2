# ST-805B Integration Map

> **Ticket**: ST-805B — Builder Integration for Arc 1 Mental Model Refactor  
> **Generated**: 2026-05-15  
> **Repo**: `razehale/mjse2` @ `3016727` (main, verified)  
> **Inputs**:
> - `lessons_v2.json` — New lesson schema with mental model pedagogy + `trigger_thresholds`
> - `st806_arc1_debriefs.json` — New debrief content (summary, what_you_did_well, what_to_fix, coach_callouts, next_focus)
> - New scoring threshold: `ball_centered_climb` (L2–L4), `ball_centered_slow_flight` (L3)

---

## Part 1 — Files That Need Modification

### Layer 1: Data & Schema (Foundation)

| # | File | Current State | Required Change | Risk |
|---|------|--------------|-----------------|------|
| 1 | `data/arc1_content_manifest.json` | V1 briefing/debrief/ground_school/quiz structure per lesson (1,689 lines) | **Replace or augment** Arc 1 entries (L1–L4) with `lessons_v2.json` data. New fields: `mentalModelOutcome`, `mentalModelMantra`, `subtitle`, `mode`, `studentLevel`, `workload`, `estimatedReadTime`, `acsAlignment`, `trigger_thresholds`. Remove old `debrief.reveal` block and point to `st806_arc1_debriefs.json` structure. | **HIGH** — Central data source for seed scripts and direct reads |
| 2 | `prisma/schema.prisma` (model `Lesson`, lines 70–99) | 22 fields. No `mentalModelOutcome`, `subtitle`, `mentalModelMantra`, `mode`, `studentLevel`, `workload`, `triggerThresholds` fields. | **Add columns**: `subtitle String?`, `mentalModelOutcome String?`, `mentalModelMantra String?`, `mode String?`, `studentLevel String?`, `workload String?`, `triggerThresholds Json?`. Requires migration. | **HIGH** — Schema change = migration + potential data loss if mishandled |
| 3 | `prisma/schema.prisma` (model `GroundSchoolContent`, lines 165–188) | Has `debriefReveal Json` (array of strings). | **Expand** to support new debrief structure from `st806_arc1_debriefs.json`: fields like `debriefSummary String?`, `whatYouDidWell Json?`, `whatToFix Json?`, `coachCallouts Json?`, `nextFocus String?`. OR store full debrief JSON in a single `debriefContent Json?` column. | **MEDIUM** — Additive columns; existing `debriefReveal` can remain for backward compat |
| 4 | `types/lessons.ts` (interface `LessonData`, lines 3–25) | No `mentalModelOutcome`, `subtitle`, `mentalModelMantra`, `mode`, `studentLevel`, `workload`, `triggerThresholds` fields. | **Add optional fields** to `LessonData` interface matching new Prisma columns. Add `ScoreBreakdown.ballCenteredClimb` field. | **LOW** — Additive, type-only |
| 5 | `types/telemetry.ts` | Has `slip_deg` in `TelemetryRow` (used for coordination scoring). | **Verify** `slip_deg` is present and correctly mapped in V5 schema. No change expected — already supported. | **NONE** |

### Layer 2: Scoring Engine (ball_centered_climb)

| # | File | Current State | Required Change | Risk |
|---|------|--------------|-----------------|------|
| 6 | `lib/s2s-engine/constants.ts` | No `BALL_CENTERED_*` constants. | **Add** `BALL_CENTERED_THRESHOLD_DEG = 3.0` (L2/L3/L4 climb), `BALL_CENTERED_SLOW_FLIGHT_DEG = 4.0` (L3 slow flight). | **LOW** |
| 7 | `lib/s2s-engine/arc1-grader.ts` — `gradeL2()` (lines 126–390) | Scores pattern cycles, flaps, trim, GTGL. No ball-centering metric. | **Add** `ball_centered_climb` metric: during CLIMB phases, compute mean |slip_deg|, score via `deviationScore(meanSlip, 0, 3.0)`. Add as metric to each pattern cycle's PhaseResult. Add coaching bullet for poor ball centering. | **MEDIUM** — Touches hot scoring path |
| 8 | `lib/s2s-engine/arc1-grader.ts` — `gradeL3()` (lines 393–496) | Scores slow flight, stalls, steep turns. No ball-centering metric. | **Add** `ball_centered_climb` for climb phases + `ball_centered_slow_flight` for slow flight phase (threshold 4.0°). | **MEDIUM** |
| 9 | `lib/s2s-engine/arc1-grader.ts` — `gradeL4()` (lines 498–573) | Scores T&Gs + emergency landing. No ball-centering metric. | **Add** `ball_centered_climb` across all 5 climb phases with `scoring_weight: 2` (higher weight than L2/L3). | **MEDIUM** |
| 10 | `lib/s2s-engine/rubrics.ts` (interface `MetricResult`) | Generic metric structure. | **No change needed** — `ball_centered_climb` fits existing `MetricResult` shape (`name`, `value`, `target`, `tolerance`, `score`). | **NONE** |
| 11 | `lib/scoring-engine.ts` (lines 80–91) | Has `coordination` scoring via `slip_deg` average. Separate from s2s-engine graders. | **Review** for conflicts. This is the legacy scoring engine (ST-510). The new `ball_centered_climb` lives in `arc1-grader.ts`. No conflict expected but both use `slip_deg`. | **LOW** — Informational only |
| 12 | `lib/s2s-engine/phase-detector.ts` | Detects CLIMB phases already. | **Verify** CLIMB phase detection correctly captures all climb segments. No change expected. | **NONE** |

### Layer 3: Seed Scripts & Data Loading

| # | File | Current State | Required Change | Risk |
|---|------|--------------|-----------------|------|
| 13 | `scripts/seed-arc1-content.ts` | Seeds `GroundSchoolContent` + `QuizSeed` from `S2S_Academic_Agent_Master_Syllabus.json`. Uses `debriefReveal` field. | **Update** to also seed new debrief content fields (from `st806_arc1_debriefs.json`). Add seeding for new `Lesson` columns (`mentalModelOutcome`, etc.) from `lessons_v2.json`. | **HIGH** — Must match schema changes exactly |
| 14 | `scripts/seed.ts` | Seeds Lesson records with basic fields. | **Update** to include new Lesson columns when creating/upserting L1–L4 records. | **MEDIUM** |
| 15 | `data/S2S_Academic_Agent_Master_Syllabus.json` | Contains `arc1DetailedContent` with ground school + quiz seeds. | **Update** or **augment** L1–L4 detailed content with new mental model fields. May also need to merge `st806_arc1_debriefs.json` debrief data into this file for seed script compatibility. | **MEDIUM** |

### Layer 4: API Routes

| # | File | Current State | Required Change | Risk |
|---|------|--------------|-----------------|------|
| 16 | `app/api/lessons/[lessonNum]/route.ts` | Returns full `Lesson` record from Prisma. | **No code change needed** — new Prisma columns auto-included in `findUnique()`. But **verify** the response shape in lesson-client.tsx. | **NONE** |
| 17 | `app/api/lessons/route.ts` | Returns all lessons with computed status. | **No code change needed** — same auto-inclusion logic. | **NONE** |
| 18 | `app/api/ground-school/[lessonNum]/route.ts` | Returns `GroundSchoolContent` record. | **No code change needed** if new debrief fields are added to GroundSchoolContent model — Prisma returns all columns. | **NONE** |

### Layer 5: UI Components

| # | File | Current State | Required Change | Risk |
|---|------|--------------|-----------------|------|
| 19 | `app/lesson/[lessonNum]/_components/lesson-client.tsx` | Fetches lesson data, renders tab navigation. No mental model display. | **Add** display of `mentalModelOutcome` and `mentalModelMantra` in lesson header area. Add `subtitle` display. | **LOW** |
| 20 | `app/lesson/[lessonNum]/_components/brief-tab.tsx` | Shows description + objectives from lesson record. | **Add** `mentalModelOutcome` card, `mentalModelMantra` quote block, `trigger_thresholds` summary (what gets scored). Replace generic objectives with `trigger_thresholds` descriptions. | **MEDIUM** — User-facing content change |
| 21 | `app/lesson/[lessonNum]/_components/ground-school-tab.tsx` | Renders ground school content from API (beforeYouFly, mission, targetNumbers, etc.). | **Add** mental model section at top. Update `targetNumbers` display to reflect new `trigger_thresholds` format if different. | **LOW** |
| 22 | `app/lesson/[lessonNum]/_components/debrief-tab.tsx` (456 lines) | Shows scoring phases, metrics, coaching bullets, GLGL tracker, debrief reveal. Fetches `debriefReveal` from ground-school API. | **Major update**: Replace simple `debriefReveal` string array with new structured debrief: `summary`, `what_you_did_well[]`, `what_to_fix[]`, `coach_callouts[]`, `next_focus`. Add `ball_centered_climb` metric rendering with ball icon. | **HIGH** — Complex component, user-facing |
| 23 | `app/lesson/[lessonNum]/_components/debrief-charts.tsx` | Renders telemetry charts for debrief. | **Add** slip/ball chart for `ball_centered_climb` visualization — show slip angle over time during climb phases. | **MEDIUM** |
| 24 | `app/lesson/[lessonNum]/_components/glgl-tracker.tsx` | GTGL sequence visualization for L2. | **No change expected** — GTGL logic unchanged. | **NONE** |
| 25 | `app/dashboard/_components/dashboard-client.tsx` | Shows lesson cards in path view. Uses `title`, `description`, `arcNum`, `isCheckFlight`. | **Add** `subtitle` and/or `mentalModelOutcome` as secondary text on lesson cards. Optional enhancement. | **LOW** |

---

## Part 2 — New Files to Create

| # | File | Purpose |
|---|------|---------|
| A | `data/lessons_v2.json` | Copy uploaded `lessons_v2.json` into the data directory for seed script consumption |
| B | `data/st806_arc1_debriefs.json` | Copy uploaded `st806_arc1_debriefs.json` into the data directory for seed script consumption |
| C | `prisma/migrations/YYYYMMDD_st805b_mental_model/migration.sql` | Auto-generated by `prisma migrate dev` after schema changes |

---

## Part 3 — Implementation Order

### Phase 1: Schema & Types (Foundation)
1. **Copy data files** → `data/lessons_v2.json`, `data/st806_arc1_debriefs.json`
2. **Update `prisma/schema.prisma`** — Add new Lesson columns + GroundSchoolContent debrief columns
3. **Run `prisma migrate dev`** — Generate and apply migration
4. **Update `types/lessons.ts`** — Add new fields to `LessonData` interface

### Phase 2: Scoring Engine (ball_centered_climb)
5. **Update `lib/s2s-engine/constants.ts`** — Add ball-centering constants
6. **Update `lib/s2s-engine/arc1-grader.ts`** — Add `ball_centered_climb` to gradeL2, gradeL3, gradeL4
7. **Test** — Run existing `st911-v5-smoke.test.ts` to verify no regressions; add new test vectors for ball_centered_climb

### Phase 3: Seed Scripts & Data
8. **Update `scripts/seed.ts`** — Populate new Lesson columns for L1–L4
9. **Update `scripts/seed-arc1-content.ts`** — Seed new debrief content fields from `st806_arc1_debriefs.json`
10. **Update `data/arc1_content_manifest.json`** — Merge mental model fields (optional, depends on whether UI reads this directly)

### Phase 4: UI Components
11. **Update `lesson-client.tsx`** — Mental model display in header
12. **Update `brief-tab.tsx`** — Mental model card + trigger thresholds
13. **Update `ground-school-tab.tsx`** — Mental model section
14. **Update `debrief-tab.tsx`** — Structured debrief (summary, what_you_did_well, etc.) + ball_centered_climb metric
15. **Update `debrief-charts.tsx`** — Slip angle chart for climb phases
16. **Update `dashboard-client.tsx`** — Subtitle on lesson cards (optional)

### Phase 5: Validation & Docs
17. **Full smoke test** — Build, seed, verify all 4 lessons render correctly
18. **Update `PROJECT_CHANGELOG.md`** — ST-805B entry
19. **Commit & push** — All changes in a single coherent commit

---

## Part 4 — Dependency Graph

```
lessons_v2.json ──┐
                   ├──▶ schema.prisma ──▶ migration ──▶ seed.ts
st806_debriefs.json┘                                    │
                                                        ▼
types/lessons.ts ◀──────────────────────────── Lesson model
       │
       ▼
constants.ts ──▶ arc1-grader.ts ──▶ s2s-engine/index.ts
       │              │
       │              ▼
       │         rubrics.ts (MetricResult)
       │              │
       ▼              ▼
brief-tab.tsx    debrief-tab.tsx ◀── ground-school API
       │              │
       ▼              ▼
lesson-client.tsx    debrief-charts.tsx
       │
       ▼
dashboard-client.tsx
```

---

## Part 5 — Risk Summary

| Risk Level | Count | Key Items |
|-----------|-------|-----------|
| **HIGH** | 4 | `arc1_content_manifest.json`, `schema.prisma`, `seed-arc1-content.ts`, `debrief-tab.tsx` |
| **MEDIUM** | 6 | `arc1-grader.ts` (×3 graders), `brief-tab.tsx`, `debrief-charts.tsx`, `seed.ts` |
| **LOW** | 5 | `constants.ts`, `types/lessons.ts`, `lesson-client.tsx`, `ground-school-tab.tsx`, `dashboard-client.tsx` |
| **NONE** | 5 | API routes (auto-return), `telemetry.ts`, `rubrics.ts`, `phase-detector.ts`, `glgl-tracker.tsx` |

---

## Part 6 — Key Decisions Needed Before Implementation

1. **Debrief storage strategy**: Single `debriefContent Json?` column on `GroundSchoolContent` (flexible) vs. individual typed columns (`debriefSummary`, `whatYouDidWell`, etc.)? Recommend: single JSON column for flexibility.

2. **`arc1_content_manifest.json` migration**: Full replace of L1–L4 entries vs. additive merge? The manifest is also used by `seed-arc1-content.ts` for ground school. Recommend: keep existing ground school data, add mental model fields, replace debrief section.

3. **`ball_centered_climb` scoring weight in overall**: Should it affect `overallScore` equally with other metrics, or be weighted differently? `lessons_v2.json` specifies `scoring_weight` per threshold — implement weighted average?

4. **`trigger_thresholds` in Brief tab**: Show raw thresholds to student (transparency) or just show descriptions? Recommend: descriptions only, with targets shown as "what to aim for."

5. **L2 title change**: `lessons_v2.json` renames L2 from "Configurator" to "Energy Management" and L3 from "Edge of the Envelope" to "Envelope Awareness". This affects the Lesson records in the database. Confirm title updates are intentional.
