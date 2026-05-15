# ST-805B PR3: UI Integration / Debrief Rendering

> **Ticket**: ST-805B  
> **PR**: #3 — UI Integration / Debrief Rendering  
> **Branch**: `st-805b-pr3-ui`  
> **Date**: 2026-05-15  
> **Depends on**: PR1 (st-805b-pr1-schema-data), PR2 (st-805c-pr2-scoring)

---

## Overview

This PR adds the UI layer for the ST-805B mental model refactor. It renders the new structured debrief content, mental model outcomes, trigger threshold descriptions, and slip/ball coordination charts across the lesson tabs.

---

## Changes by Component

### 1. Ground School Tab (`ground-school-tab.tsx`)
**Mental Model Outcome Card** — added at top of ground school page

- Displays `mentalModelOutcome` from lesson data as a quoted callout
- Displays `mentalModelMantra` below in a styled mono-font callout (when present)
- Uses `Brain` icon with gradient border styling
- Only renders when `mentalModelOutcome` is non-null
- L1: "The airplane responds to my inputs" (no mantra)
- L2: "I manage energy with power and pitch" + "Power = Energy. Pitch = Distribution."
- L3: "I know where the edges are and how to stay inside them" + "Low-energy boundary. High-load boundary. Stay inside."
- L4: Unified framework (no mantra)

### 2. Brief Tab (`brief-tab.tsx`)
**Trigger Thresholds Section** — "What Gets Scored"

- Parses `triggerThresholds` (semicolon-delimited string from PR1) into structured items
- Renders as numbered list with human-readable descriptions only (no raw values)
- Uses `Crosshair` icon with amber styling
- Displays items like "Ball Centered Climb: Slip/skid ball centered ±3° during climb phases"
- Format: `name: description` from the stored string

### 3. Debrief Tab (`debrief-tab.tsx`)
**Structured Multi-Section Debrief** — major overhaul

Parses `debriefContent` (JSON stored on Lesson model from `st806_arc1_debriefs.json`) into five distinct sections:

| Section | Icon | Styling | Content |
|---------|------|---------|---------|
| **Debrief Summary** | Brain | Card/border | Narrative summary of the lesson's learning |
| **What You Did Well** | ThumbsUp | Emerald/green | Bullet list of successes with checkmark icons |
| **What To Fix** | Wrench | Amber/yellow | Bullet list of actionable fixes |
| **Coach Callouts** | Compass | Purple | Boxed callouts with deeper coaching insights |
| **Next Focus** | ArrowRight | Blue | Forward-looking guidance for next lesson |

**Backward Compatibility**:
- If `debriefContent` is null/invalid, falls back to legacy coaching bullets from the scoring engine
- If no scoring engine bullets either, falls back to `debriefTemplate` static text
- Legacy `debriefReveal` (string array from ST-802C) only shown when no structured debrief present
- When both structured debrief AND engine coaching bullets exist, engine bullets shown as supplementary "Scoring Engine Notes"

### 4. Debrief Charts (`debrief-charts.tsx`)
**Slip/Ball Coordination Chart** — new visualization

- Shows `slip_deg` over time during airborne phases
- Only rendered for L2+ (where ball-centering is scored)
- Filters to airborne-only samples (`on_ground === 0`)
- Tolerance zones:
  - ±3.0° green shaded area (climb tolerance, all lessons)
  - ±4.0° purple shaded area (slow flight tolerance, L3 only)
- Center reference line at 0° ("Centered")
- Y-axis range: -8° to +8°
- Accepts new `lessonNum` prop to determine which tolerance zones to display

### 5. Lesson Titles in Hub
- **Already updated in PR1**: L2 → "Energy Management", L3 → "Envelope Awareness"
- Dashboard reads `lesson.title` from database — no additional UI code changes needed

---

## Files Changed

| File | Lines Changed | Type |
|------|-------------|------|
| `app/lesson/[lessonNum]/_components/ground-school-tab.tsx` | +31 | Mental model card |
| `app/lesson/[lessonNum]/_components/brief-tab.tsx` | +58 | Trigger thresholds |
| `app/lesson/[lessonNum]/_components/debrief-tab.tsx` | +120 | Structured debrief |
| `app/lesson/[lessonNum]/_components/debrief-charts.tsx` | +52 | Slip/ball chart |
| `ST-805B_PR3_SUMMARY.md` | new | This document |

---

## Data Flow

```
Lesson model (Prisma)
  ├── mentalModelOutcome  ──→  ground-school-tab.tsx (Mental Model card)
  ├── mentalModelMantra   ──→  ground-school-tab.tsx (Mantra callout)
  ├── triggerThresholds   ──→  brief-tab.tsx (What Gets Scored)
  └── debriefContent      ──→  debrief-tab.tsx (Structured debrief sections)

Telemetry sampledRows
  └── slip_deg / on_ground  ──→  debrief-charts.tsx (Slip/Ball chart)
```

---

## Build Status

- ✅ `next build` passes with zero errors
- ✅ All existing components unaffected
- ✅ Backward compatible with lessons lacking new fields (graceful null handling)

---

## Path View Impact

**No changes to lesson progression, gating, pass rules, or existing scoring.**

- All changes are display-only (UI rendering)
- No new API routes added
- No schema changes (uses fields from PR1)
- Students see richer debrief content but scoring behavior is identical

---

## Screenshots / Visual Guide

### Ground School Tab — Mental Model Card
```
┌─────────────────────────────────────────────────────┐
│ 🧠 Mental Model                                     │
│ "I manage energy with power and pitch"               │
│ ┌───────────────────────────────────────────────────┐│
│ │ MANTRA                                            ││
│ │ Power = Energy. Pitch = Distribution.             ││
│ └───────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

### Brief Tab — What Gets Scored
```
┌─────────────────────────────────────────────────────┐
│ ⊕ What Gets Scored                                   │
│ Items the scoring engine evaluates during your flight│
│                                                      │
│ 1  Walkaround Complete                               │
│    REP walkaround completed                          │
│ 2  Go Around Executed                                │
│    Go-around initiated from short final              │
│ 3  Ball Centered Climb                               │
│    Slip/skid ball centered ±3° during climb phases   │
└─────────────────────────────────────────────────────┘
```

### Debrief Tab — Structured Sections
```
┌─────────────────────────────────────────────────────┐
│ 🧠 Debrief Summary                                  │
│ Power = Energy. Pitch = Distribution. That's the    │
│ model. Everything you did today was an energy...     │
├─────────────────────────────────────────────────────┤
│ 👍 What You Did Well                                │
│ ✓ You used power changes to manage total energy...  │
│ ✓ You executed the go-around...                     │
├─────────────────────────────────────────────────────┤
│ 🔧 What To Fix                                     │
│ ▸ Ball centered in the climb. This is graded...     │
│ ▸ Stop chasing airspeed with the throttle...        │
├─────────────────────────────────────────────────────┤
│ 🧭 Coach Callouts                                   │
│ ┌─ Power = Energy. Pitch = Distribution. Say it... ┐│
│ └──────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────┤
│ → Next Focus                                        │
│ Lesson 3 shows you where the edges are...           │
└─────────────────────────────────────────────────────┘
```

### Slip/Ball Chart
```
  Coordination — Slip/Skid Ball (Airborne)
  ┌──────────────────────────────────────────┐
  │  8° ──────────────────────────────────── │
  │      ╭╮  ╭─╮                             │
  │  4° ─╯╰╮╯  ╰╮──────────── ±4° (L3 only)│
  │  3° ───╰────╰─╮────────── ±3° (climb)   │
  │  0° ═══════════╰═══════ Centered         │
  │ -3° ──────────────────────                │
  │ -8° ──────────────────────────────────── │
  │     0s     60s    120s   180s    240s     │
  └──────────────────────────────────────────┘
```
