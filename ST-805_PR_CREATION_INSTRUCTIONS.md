# ST-805B / ST-805C — PR Creation (Manual, via GitHub Web UI)

> Why manual: The Abacus GitHub App installation token can push branches to `razehale/mjse2` but is not granted effective `pull_requests: write`. Both REST and GraphQL return `403 / "Resource not accessible by integration"` on PR create. Three paths to unblock were offered; you chose **manual creation via the web UI**. This file gives you the compare links + exact title/body for each PR — three copy-paste passes and you're done.

**Repo:** `razehale/mjse2`
**Base branch (all 3):** `main` (`3016727962a139bfa505cda1c30451d6039f6b38`)

---

## PR1 — Schema + Data Plumbing

**Compare link (click → "Create pull request"):**
https://github.com/razehale/mjse2/compare/main...st-805b-pr1-schema-data?expand=1

**Head ref:** `st-805b-pr1-schema-data` (`cf645bc5cda0c00847bfaafd010e61ab0662088d`)

**Title:**
```
PR1: Schema + Data Plumbing for Arc 1 Mental Models (ST-805B)
```

**Body:**
```markdown
## Summary
Schema updates for Arc 1 mental model refactor:
- Added debriefContent (Json), mentalModelOutcome, mentalModelMantra, triggerThresholds fields to Lesson model
- Integrated arc1_content_manifest v2.0 with ST-806 structured debriefs
- Updated seed scripts for new data structure

## Path View Impact
Display-only changes. No lesson gating or progression logic modified.

## References
ST-805B, ST-806
```

---

## PR2 — Scoring Engine (Ball Coordination Metrics)

**Compare link:**
https://github.com/razehale/mjse2/compare/main...st-805c-pr2-scoring?expand=1

**Head ref:** `st-805c-pr2-scoring` (`0b19eb3b0e913ec2daafddc75d0afa4d6fe5386b`)

**Title:**
```
PR2: Scoring Engine - Ball Coordination Metrics (ST-805C)
```

**Body:**
```markdown
## Summary
Added coordination metrics to Arc 1 scoring:
- ball_centered_climb (±3.0°) for L2, L3, L4
- ball_centered_slow_flight (±4.0°) for L3
- L4 double-weight coordination emphasis

## Testing
37/37 unit tests passing. V5 integration verified.

## Path View Impact
Scoring refinement only. No lesson gating changes.

## References
ST-805C
```

---

## PR3 — UI Integration (Mental Models & Structured Debriefs)

**Compare link:**
https://github.com/razehale/mjse2/compare/main...st-805b-pr3-ui?expand=1

**Head ref:** `st-805b-pr3-ui` (`c578b000e95ccbd92706a0fb5dbe70e2aa0b273e`)

**Title:**
```
PR3: UI Integration - Mental Models & Structured Debriefs (ST-805B)
```

**Body:**
```markdown
## Summary
UI updates for mental model pedagogy:
- Ground School: Mental model outcome cards
- Brief: Trigger thresholds display
- Debrief: Structured multi-section rendering
- Charts: Slip/ball coordination visualization

## Build Status
Production build verified (0 errors)

## Path View Impact
Display enhancement only. No progression logic changes.

## References
ST-805B, ST-806
```

---

## After You Create the PRs

Please reply with the three PR numbers (or just paste the URLs). I'll record them in `PROJECT_CHANGELOG.md` and the ST-805B/C completion artifacts so the trail is closed.

If you'd rather I retry the API path, the alternate unblock options remain:
1. Re-approve the Abacus GitHub App at https://github.com/settings/installations and grant `Pull requests: Read and write` for `razehale/mjse2`.
2. Paste a Personal Access Token (classic `repo` or fine-grained with `Pull requests: RW` + `Contents: R`) and I'll create them programmatically in seconds.
