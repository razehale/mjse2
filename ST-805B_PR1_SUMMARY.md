# ST-805B PR1: Schema + Data Plumbing for Arc 1 Mental Models

**Ticket:** ST-805B  
**PR:** PR1 of 3 (Schema + Data)  
**Date:** 2026-05-15  
**Branch:** `st-805b-pr1-schema-data`  
**Risk Level:** MEDIUM (schema change + DB reset, no production data)

---

## Summary

This PR adds the data foundation for the Arc 1 mental model pedagogy refactor. Four new columns on the `Lesson` model store structured debrief content, mental model outcomes/mantras, and human-readable trigger thresholds. All seed scripts are updated to populate these fields from the new `lessons_v2.json` and `st806_arc1_debriefs.json` source data.

---

## Changes

### 1. Prisma Schema (`prisma/schema.prisma`)
- **Added 4 columns** to `Lesson` model:
  - `debriefContent Json?` — Structured debrief (summary, what_you_did_well, what_to_fix, coach_callouts, next_focus)
  - `mentalModelOutcome String?` — One-sentence outcome per lesson
  - `mentalModelMantra String?` — Repeatable mantra (null for L1, L4)
  - `triggerThresholds String?` — Semicolon-delimited human-readable threshold descriptions
- **Migration generated:** `20260515120725_add_mental_model_fields`
- **Fixed** Prisma client output path from hardcoded absolute to relative

### 2. TypeScript Types (`types/lessons.ts`)
- Added `debriefContent`, `mentalModelOutcome`, `mentalModelMantra`, `triggerThresholds` to `LessonData` interface
- Added `DebriefContent` interface (summary, what_you_did_well, what_to_fix, coach_callouts, next_focus)
- Added `DebriefEntry` interface for typed debrief JSON consumption

### 3. Content Manifest (`data/arc1_content_manifest.json`)
- **Additive merge** — all existing ground school content preserved
- Updated lesson titles: L2 → "Energy Management", L3 → "Envelope Awareness"
- Added `mentalModelOutcome`, `mentalModelMantra`, `subtitle`, `arcTitle` to each lesson
- Added `triggerThresholds` as human-readable descriptions
- **Replaced debrief sections** with structured ST-806 content (mentalModel, content object)
- Added `quizSeeds` from lessons_v2.json (L2: 5 questions, L3: 5 questions, L4: 5 questions)
- Added `gateRequirements` for L4 check flight
- Version bumped to 2.0

### 4. Source Data Files (new)
- `data/lessons_v2.json` — Full Arc 1 lesson structure with mental models, trigger thresholds, quiz seeds
- `data/st806_arc1_debriefs.json` — Structured debrief content for L1-L4

### 5. Seed Scripts
- **`scripts/seed.ts`** — Updated Arc 1 lesson data (titles, descriptions, objectives, ST-805B fields). Updated upsert logic to include `mentalModelOutcome`, `mentalModelMantra`, `triggerThresholds`.
- **`scripts/seed-arc1-content.ts`** — Now loads `st806_arc1_debriefs.json` and `lessons_v2.json` to populate `debriefContent` and mental model fields on the Lesson table via `prisma.lesson.updateMany()`.

---

## Verification

| Check | Result |
|-------|--------|
| `prisma migrate dev` | ✅ Migration applied |
| `prisma generate` | ✅ Client generated |
| `seed.ts` execution | ✅ 17 lessons seeded with ST-805B fields |
| `seed-arc1-content.ts` execution | ✅ 4 ground school + 20 quiz seeds + 4 debriefs |
| L1 mentalModelOutcome | ✅ "The airplane responds to my inputs" |
| L2 mentalModelMantra | ✅ "Power = Energy. Pitch = Distribution." |
| L3 debriefContent | ✅ Structured JSON with 5 keys |
| L4 triggerThresholds | ✅ 8 thresholds as semicolon-delimited string |
| Ground school content preserved | ✅ All concepts, missions, target numbers intact |

---

## What's Next (PR2 + PR3)

- **PR2: Scoring Engine** — Integrate `ball_centered_climb` and `ball_centered_slow_flight` into `arc1-grader.ts` and `constants.ts`
- **PR3: UI Components** — Update debrief-tab, brief-tab to render new mental model fields and structured debrief content

---

## Database Impact

- **DB was reset** (user decision — no production data to preserve)
- All existing migrations replayed + new migration applied
- Seeds repopulated all 17 lessons, 4 quizzes, 4 ground school records, 20 quiz seeds
