# Screen to Sky (S2S) Backbone Report — v5

## Build History

| Version | Stories | Summary |
|---------|---------|------------------------------------------|
| v1 | ST-511 | Foundation: auth, path view, CSV upload, basic scoring, admin |
| v2 | ST-802B/C/D | Ground school content, QuizSeed system, debrief reveal |
| v3 | ST-802D+ | L2 GLGL doctrine, go-around detection, Machado quiz gate |
| v4 | ST-963 | Engine v2: landing scorer, GTGL sequence detector, commitment gate, safety overrides, per-leg scoring |
| v5 | ST-900 | Admin gradebook, shadow mode (impersonation), path view overrides, INSTRUCTOR role |

---

## 1. Architecture

| Layer | Technology |
|-------|------------|
| Framework | App Router (server/client component separation) |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth.js v4, JWT strategy, Credentials provider |
| Storage | S3 via presigned URLs (telemetry CSVs) |
| Visualization | Recharts (debrief charts) |
| Animation | Framer Motion |
| Scoring Engine | Custom TypeScript (lib/s2s-engine/) |

---

## 2. Database Schema

```
User (id, email, password_hash, role[ADMIN|INSTRUCTOR|STUDENT], name)
  ├─ Account (NextAuth)
  ├─ AuthSession (NextAuth)
  ├─ FlightSession[] (telemetry uploads)
  ├─ UserProgress[] (per-lesson tracking)
  └─ QuizAttempt[] (quiz-seed-based attempts)

Lesson (id, lesson_num[1-17], arc_num[1-5], title, description, ...)
  ├─ objectives: JSON string[]
  ├─ Readiness flags: flightSchoolReady, groundSchoolReady, quizReady, scoringReady, mediaReady
  ├─ Production notes: 4 text fields for content agents
  ├─ FlightSession[]
  └─ UserProgress[]

Quiz (id, quiz_num[250-253], title, questions: JSON, required_score)
  └─ Legacy check-flight quizzes only

GroundSchoolContent (id, lesson_num[@unique], title, arc, mode, ...)
  ├─ acsAlignment, repWalkthroughFocus, beforeYouFly: JSON
  ├─ mission, whatMattersToday, targetNumbers: JSON
  ├─ simpleFlightFlow, commonMistakes, doNotWorryAboutYet: JSON
  ├─ debriefReveal: JSON
  └─ cfiNotes: String? (nullable)

QuizSeed (id, lesson_num, question, options: JSON, correct_index, explanation)
  └─ 5 seeds per lesson (L1-L4 seeded, 4/5 to pass)

QuizAttempt (id, user_id, lesson_num, answers: JSON, correct_count, total_count, passed)

FlightSession (id, user_id, lesson_id, csv_filename, cloud_storage_path, parsed_data: JSON)
  ├─ Attempt[] (flight segments)
  └─ Score[] (1-5 scale)

Attempt (id, session_id, segment_type, start_time, end_time, metrics: JSON, confidence)

Score (id, session_id, overall_score[1-5], breakdown: JSON)

UserProgress (id, user_id, lesson_id, flight_score, quiz_passed, debrief_viewed, status)
  └─ Unique constraint: [userId, lessonId]
```

---

## 3. S2S Scoring Engine (lib/s2s-engine/)

Pure TypeScript engine — no Python dependency. Runs in Node.js production.

### Core Pipeline

```
CSV Text → loadTelemetry(csv, 1Hz) → detectPhases(df) → gradeL#(df, phases) → LessonResult
                                                                                    ↓
                                                                              toDict() / toHtml()
```

### Module Inventory

| Module | File | Purpose |
|--------|------|-------------------------------|
| Entry Point | `index.ts` | `evaluateFlight(csvText, lessonId, filename, opts)` → {result, json, html} |
| Telemetry Parser | `telemetry-parser.ts` | CSV parser, FlyWithLua header handling, 1Hz linear-interpolation resampling |
| Phase Detector | `phase-detector.ts` | State-machine flight phase classification (taxi, takeoff, climb, downwind, base, final, landing, T&G, stall, steep turn, slow flight) |
| Constants | `constants.ts` | V-speeds, KHMP data, arc tolerances, GTGL constants, commitment gate thresholds, geo helpers |
| Rubrics | `rubrics.ts` | MetricResult, PhaseResult, SafetyFlag, LessonResult types + scoring utilities |
| Arc 1 Grader | `arc1-grader.ts` | Full L1-L4 grading (per-leg scoring, GTGL integration, landing scorer) |
| Arc Stubs | `arc-stubs.ts` | L5-L17 stub returning LESSON_NOT_IMPLEMENTED |
| Landing Scorer | `landing-scorer.ts` | VS-based severity (Greaser/Smooth/Acceptable/Firm/Rough), weighted composite (VS 50%, hdg 25%, IAS 25%) |
| GTGL Detector | `gtgl-sequence-detector.ts` | 4-state machine (GA1→TNG→GA2→LAND), builds GTGLResult with pass conditions |
| Go-Around | `maneuvers/go-around.ts` | GA detection, commitment gate, early GA detection, safety overrides (stall/touchdown/sink→score=1) |
| JSON Formatter | `json-formatter.ts` | `toDict()` / `toJson()` matching Python schema, includes extras |
| HTML Generator | `html-generator.ts` | Styled debrief HTML with phase breakdowns, coaching bullets |
| Ground School | `ground-school.ts` | DB query helper for GroundSchoolContent |
| Quiz Helper | `quiz.ts` | DB query helper for QuizSeed data |

### Key Constants

| Constant | Value | Unit |
|----------|-------|------|
| Vr | 55 | kts |
| Vy | 74 | kts |
| V_DOWNWIND | 90 | kts |
| V_APPROACH | 65 | kts |
| V_BEST_GLIDE | 68 | kts |
| KHMP Elev | 882 | ft MSL |
| Pattern Alt | 1,882 | ft MSL (1,000 AGL) |

### Grading Scale

| Score | Label | Meaning |
|-------|-------|---------|
| 1 | Rough | Needs significant work |
| 2 | Developing | Below standard |
| 3 | Solid | Meets standard (passing) |
| 4 | Sharp | Above average |
| 5 | Nailed it | Excellent |

### Landing Severity Scale

| VS (fpm) | Severity | Color |
|----------|----------|-------|
| ≤ 100 | Greaser | emerald |
| ≤ 200 | Smooth | sky |
| ≤ 350 | Acceptable | amber |
| ≤ 600 | Firm | orange |
| > 600 | Rough | red |

### L2 Pass Conditions
- GTGL sequence complete (GA1 → T&G → GA2 → Land)
- ≥ 3 pattern cycles completed
- ≥ 2/3 flap deployment on downwind
- ≥ 2/3 trim usage in pattern
- Quiz seeds passed (4/5 correct)

---

## 4. API Routes

### Auth & User

| Route | Method | Purpose |
|-------|--------|--------------------------------------|
| `/api/signup` | POST | Student registration (default STUDENT role) |
| `/api/auth/login` | POST | Credential validation |
| `/api/auth/[...nextauth]` | * | NextAuth handlers |

### Lessons & Progress

| Route | Method | Purpose |
|-------|--------|--------------------------------------|
| `/api/lessons` | GET | All lessons with computed status for current user |
| `/api/lessons/[lessonNum]` | GET | Single lesson with progress, sessions, quiz, hasQuizSeeds, latestQuizAttempt |
| `/api/sessions` | POST | Upload & process telemetry CSV (runs evaluateFlight) |
| `/api/sessions/[sessionId]` | GET | Fetch session with scores & attempts (owner/admin/instructor) |
| `/api/progress/debrief-viewed` | POST | Mark debrief viewed, evaluate pass conditions (dynamic quiz-aware) |
| `/api/upload/presigned` | POST | Generate S3 presigned upload URL |

### Ground School & Quizzes

| Route | Method | Purpose |
|-------|--------|--------------------------------------|
| `/api/ground-school/[lessonNum]` | GET | Ground school content + debriefReveal + cfiNotes |
| `/api/quiz-seeds/[lessonNum]` | GET | Quiz questions (answers stripped) |
| `/api/quiz-seeds/submit` | POST | Submit quiz answers, evaluate pass, update progress |
| `/api/quiz/submit` | POST | Legacy check-flight quiz submission |
| `/api/l2-doctrine` | GET | L2 GLGL doctrine content |

### Admin (ADMIN + INSTRUCTOR)

| Route | Method | Purpose |
|-------|--------|--------------------------------------|
| `/api/admin/students` | GET | List all STUDENT users with progress + last 5 sessions |
| `/api/admin/gradebook` | GET | Enriched roster: avg score, current lesson, activity status, full sessions |
| `/api/admin/force-complete` | POST | Force-complete a lesson for any student (sets score=5, all gates=true) |
| `/api/admin/reset-progress` | POST | Delete UserProgress record (revert to LOCKED) |
| `/api/admin/lesson-flags` | PATCH | Toggle content readiness flags |
| `/api/admin/shadow-lessons` | GET | Fetch lessons with computed status for a target student (impersonation) |

---

## 5. UI Pages

| Page | Route | Key Features |
|------|-------|--------------|
| Login/Signup | `/login` | Email/password auth, framer-motion animations |
| Dashboard | `/dashboard` | Path View spine, 17 nodes, arc grouping, shadow mode support, right-click context menu |
| Lesson Detail | `/lesson/[num]` | 5 tabs: Brief, Ground School, Quiz, Flight, Debrief |
| Admin Dashboard | `/admin` | Student list, force complete, readiness flag toggles, gradebook nav |
| Gradebook | `/admin/gradebook` | Roster table, search, session drill-down, score breakdowns, HTML debriefs, "View as Student" |

### Lesson Detail Tabs

| Tab | Component | Availability |
|-----|-----------|----------------------------------|
| Brief | `brief-tab.tsx` | Always (+ L2 Doctrine insert) |
| Ground School | `ground-school-tab.tsx` | When `groundSchoolReady=true` |
| Quiz | `quiz-seed-tab.tsx` | When `quizReady=true` (QuizSeed-based) |
| Quiz (Legacy) | `quiz-tab.tsx` | Fallback for check flights with old Quiz model |
| Flight | `flight-tab.tsx` | Always (Machado quiz gate for L2/L4) |
| Debrief | `debrief-tab.tsx` | After flight uploaded (charts, coaching, GLGL tracker, CFI notes, reveal) |

### Shadow Mode System

| Component | File | Purpose |
|-----------|------|----------------------------|
| ShadowContext | `lib/shadow-context.tsx` | React context: shadowUserId, shadowUserName, isActive |
| ShadowProvider | `lib/shadow-context.tsx` | Wraps app via providers.tsx |
| AdminShadowBar | `components/admin-shadow-bar.tsx` | Fixed purple banner: "SHADOWING: [Name] \| EXIT" |
| providers.tsx | `components/providers.tsx` | SessionProvider + ShadowProvider + AdminShadowBar |

---

## 6. User Roles & Access

| Role | Dashboard | Lessons | Admin | Gradebook | Shadow Mode |
|------|-----------|---------|-------|-----------|-------------|
| STUDENT | Own path only | Gate-locked | ❌ Redirected | ❌ | ❌ |
| INSTRUCTOR | Own path | All accessible | ✅ | ✅ | ✅ (read-only + overrides) |
| ADMIN | Own path (bypass) | All accessible | ✅ | ✅ | ✅ (read-only + overrides) |

### Security Gates
- **Middleware**: `withAuth` blocks non-authenticated from `/dashboard/*`, `/lesson/*`, `/admin/*`
- **Admin routes**: Server-side role check + API-level role check (ADMIN \|\| INSTRUCTOR)
- **Session detail**: Owner OR ADMIN OR INSTRUCTOR
- **Shadow mode**: Client-side read-only (clicks disabled), context menu for overrides only

---

## 7. Gate Logic

### Standard Progression
```
Previous lesson PASSED → Current lesson AVAILABLE
  ↓ Upload telemetry → flight_score set → IN_PROGRESS or NEEDS_DEBRIEF
  ↓ View debrief → debrief_viewed = true
  ↓ Pass quiz (if quizReady) → quiz_passed = true
  ↓ All conditions met? → PASSED → Next lesson unlocks
```

### Pass Conditions (Dynamic)
- `flightScore >= 3`
- `debriefViewed = true`
- `quizPassed = true` (only if QuizSeed records exist for that lesson)
- L2 additionally: GTGL sequence complete

### Admin Override
- Force Complete: Sets flightScore=5, quizPassed=true, debriefViewed=true, status=PASSED
- Reset: Deletes UserProgress record entirely

---

## 8. Content Status

### Lesson Readiness Map

| L# | Arc | Title | Flight | Ground | Quiz | Scoring | Media |
|----|-----|-------|--------|--------|------|---------|-------|
| 1 | 1 | Long Walk | ✅ | ✅ | ✅ | ✅ | ❌ |
| 2 | 1 | Configurator (GLGL) | ✅ | ✅ | ✅ | ✅ | ❌ |
| 3 | 1 | Edge of Envelope | ✅ | ✅ | ✅ | ❌ | ❌ |
| 4 | 1 | Arc 1 Check | ✅ | ✅ | ✅ | ❌ | ❌ |
| 5 | 2 | The Box | ❌ | ❌ | ❌ | ❌ | ❌ |
| 6 | 2 | Wind Whisperer | ❌ | ❌ | ❌ | ❌ | ❌ |
| 7 | 2 | Arc 2 Check | ❌ | ❌ | ✅ | ❌ | ❌ |
| 8 | 3 | Breaking Free | ❌ | ❌ | ❌ | ❌ | ❌ |
| 9 | 3 | Compass Rose | ❌ | ❌ | ❌ | ❌ | ❌ |
| 10 | 3 | Arc 3 Check | ❌ | ❌ | ✅ | ❌ | ❌ |
| 11 | 4 | Dead Stick | ❌ | ❌ | ❌ | ❌ | ❌ |
| 12 | 4 | Weather Wise | ❌ | ❌ | ❌ | ❌ | ❌ |
| 13 | 4 | Night Owl | ❌ | ❌ | ❌ | ❌ | ❌ |
| 14 | 4 | Arc 4 Check | ❌ | ❌ | ✅ | ❌ | ❌ |
| 15 | 5 | Flight Plan | ❌ | ❌ | ❌ | ❌ | ❌ |
| 16 | 5 | Dual XC | ❌ | ❌ | ❌ | ❌ | ❌ |
| 17 | 5 | Solo XC | ❌ | ❌ | ❌ | ❌ | ❌ |

### Data Seeding
- `scripts/seed.ts` — 17 lessons, admin user, 4 legacy quizzes
- `scripts/seed-arc1-content.ts` — L1-L4 ground school + quiz seeds from `data/S2S_Academic_Agent_Master_Syllabus.json`
- `data/arc1_content_manifest.json` — L1-L4 full content + L5-L17 stubs

---

## 9. Telemetry Parser Field Mappings

| CSV Column | Type | Unit | Notes |
|-----------|------|------|-------|
| t_sec | float | seconds | Time since recording start |
| sim_time | float | seconds | X-Plane sim time |
| lat, lon | float | degrees | WGS84 coordinates |
| alt_msl | float | feet | Altitude above mean sea level |
| alt_agl | float | feet | Altitude above ground level |
| ias_kts | float | knots | Indicated airspeed |
| gs_kts | float | knots | Ground speed |
| vs_fpm | float | ft/min | Vertical speed |
| pitch_deg, roll_deg, hdg_deg | float | degrees | Attitude |
| aileron, elevator, rudder | float | -1 to 1 | Control deflections |
| throttle, mixture | float | 0 to 1 | Engine controls |
| flap_ratio | float | 0 to 1 | Flap deployment |
| on_ground | int | 0/1 | Weight on wheels |
| stall_warn | int | 0/1 | Stall warning active |
| slip_deg | float | degrees | Ball deflection |

Missing columns default to 0. Parser never crashes on missing data.

---

## 10. Admin Operations

### Login
1. `admin@s2s.com` / `S2SA123`
2. All lessons clickable regardless of gate status

### Admin Dashboard (`/admin`)
- Students tab: progress grid (17 dots), force complete buttons
- Lessons tab: readiness flag toggles (5 per lesson)
- Gradebook button → `/admin/gradebook`

### Gradebook (`/admin/gradebook`)
- Roster: Name, Current Lesson, Avg Score, Last Flight, Status, Actions
- Search: Filter by name or email
- Expand: Click row → session drill-down (score breakdowns, segments, HTML debriefs)
- Shadow: "View as Student" → impersonation mode

### Shadow Mode
1. Click "View as Student" in Gradebook
2. Dashboard shows student's Path View (read-only)
3. Purple banner: `SHADOWING: [Name] | Read-Only View | EXIT`
4. Right-click any lesson → context menu:
   - ✅ **Pass Lesson** — force complete (score=5, all gates=true)
   - ⚠️ **Reset Lesson** — delete progress (revert to LOCKED)
5. Click EXIT to return to admin's own view

---

## 11. What Remains

### Content Production
- [ ] L1-L4: Media assets (video content)
- [ ] L3 scoring: Stall recovery grading
- [ ] L4 scoring: T&G consistency + emergency scenarios
- [ ] Arc 2-5 (L5-L17): All content (objectives, briefs, rubrics, ground school, quizzes)
- [ ] Legacy Quiz 250-253: Expand to full question sets or migrate to QuizSeed

### Engine Enhancements
- [ ] Arc 2-5 graders (currently stubs)
- [ ] Wind estimation from ground track vs heading
- [ ] REP walk-around dataref integration
- [ ] More sophisticated segment boundary detection

### Platform Features
- [ ] Real-time telemetry streaming (WebSocket)
- [ ] 3D flight replay viewer
- [ ] Instructor annotation system on debriefs
- [ ] Student-to-student comparison
- [ ] Achievement/badge system
- [ ] Mobile-optimized layout
- [ ] Instructor account creation UI

---

## 12. File Inventory

### Scoring Engine (lib/s2s-engine/)
```
index.ts              — Entry point, evaluateFlight()
telemetry-parser.ts   — CSV parser, resampling
phase-detector.ts     — Flight phase state machine
constants.ts          — V-speeds, KHMP, tolerances, geo helpers
rubrics.ts            — Types + scoring utilities
arc1-grader.ts        — L1-L4 grading logic
arc-stubs.ts          — L5-L17 stub grader
landing-scorer.ts     — VS-based landing scoring
gtgl-sequence-detector.ts — GTGL 4-state machine
maneuvers/go-around.ts — GA detection, commitment gate, safety overrides
json-formatter.ts     — JSON output serialization
html-generator.ts     — HTML debrief report
ground-school.ts      — DB query helper
quiz.ts               — DB query helper
```

### API Routes (app/api/)
```
auth/login/           — Credential login
auth/[...nextauth]/   — NextAuth handlers
signup/               — Student registration
lessons/              — All lessons + computed status
lessons/[lessonNum]/  — Single lesson detail
sessions/             — Upload + process telemetry
sessions/[sessionId]/ — Session detail
progress/debrief-viewed/ — Mark debrief viewed
upload/presigned/     — S3 presigned URL
ground-school/[lessonNum]/ — Ground school content
quiz-seeds/[lessonNum]/    — Quiz questions (stripped)
quiz-seeds/submit/    — Quiz submission
quiz/submit/          — Legacy quiz submission
l2-doctrine/          — GLGL doctrine content
admin/students/       — Student list
admin/gradebook/      — Enriched roster data
admin/force-complete/  — Force complete lesson
admin/reset-progress/ — Reset lesson progress
admin/lesson-flags/   — Toggle readiness flags
admin/shadow-lessons/ — Lessons for shadow user
```

### UI Components (app/)
```
login/_components/login-form.tsx
dashboard/_components/dashboard-client.tsx  (+ shadow mode + context menu)
lesson/[lessonNum]/_components/
  ├─ lesson-client.tsx    — Tab orchestrator
  ├─ brief-tab.tsx        — Lesson brief (+ L2 Doctrine insert)
  ├─ ground-school-tab.tsx — Ground school content
  ├─ quiz-seed-tab.tsx    — QuizSeed-based quiz
  ├─ quiz-tab.tsx         — Legacy quiz
  ├─ flight-tab.tsx       — CSV upload (+ Machado quiz gate)
  ├─ debrief-tab.tsx      — Debrief (charts, coaching, GLGL, CFI notes, reveal)
  ├─ debrief-charts.tsx   — Recharts visualization
  ├─ glgl-tracker.tsx     — L2 GLGL sequence tracker
  └─ l2-doctrine.tsx      — L2 go-around doctrine display
admin/_components/admin-client.tsx
admin/gradebook/_components/gradebook-client.tsx
```

### Shared Components
```
components/providers.tsx         — SessionProvider + ShadowProvider + AdminShadowBar
components/admin-shadow-bar.tsx  — Persistent shadow mode banner
lib/shadow-context.tsx           — Shadow mode React context
```

---

*Generated: S2S Backbone v5 — ST-900 Merge*
