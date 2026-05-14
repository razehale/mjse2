## [v1.0.1-beta] - 2026-05-14

- ID: ST-911 | Date: 2026-05-14T17:00:00Z | Author: Mike (Lead Developer / Build Agent)
  - Type: Schema Sync
  - Risk: High (telemetry/scoring)
  - Files changed: nextjs_space/lib/s2s-engine/telemetry-parser.ts, nextjs_space/lib/telemetry-parser.ts, nextjs_space/types/telemetry.ts, tests/integration/smoke_v5_csv_test.ts
  - Summary: Telemetry parser synced to V5 schema. Column mappings updated for `alt_msl_ft`, `alt_agl_ft`, `hdg_mag_deg` renames and 7 new V5 fields added. Integration smoke tests for V5 telemetry vectors created.
  - Why: V5 recorder CSVs use renamed/new columns that broke the parser's COL_MAP lookup, causing "Missing Column" errors and downstream scoring failures.
  - Testing: `evaluateFlight()` smoke test passed (25/25 assertions). V5 CSV vectors: `s2s_telemetry_20260511_173825.csv`, `s2s_telemetry_20260511_204358.csv`.
  - Path View Impact: No changes to scoring logic, lesson gating, or student progression. See `ST-911_PATH_VIEW_IMPACT.md`.
  - Acceptance: Successful V5 CSV parse without errors; CI/CD pass; Path View Impact statement filed; changelog updated.
  - Revert plan: Restore prior COL_MAP entries in both `telemetry-parser.ts` files and remove new `telemetry.ts` fields.

### Added
- ST-911: Telemetry Parser V5 Support.
- Integration smoke tests for V5 telemetry vectors.
- `ST-911_PATH_VIEW_IMPACT.md` — Path View Impact statement.
- `ST-911_SCHEMA_DELTA_ANALYSIS.md` — Schema delta analysis document.

### Fixed
- Fixed column mapping mismatch between blackbox.lua V5 output and parser.ts COL_MAP.
- Added backward-compatible aliases for renamed V5 columns (`alt_msl_ft` ← `alt_ft`, `alt_agl_ft` ← `agl_ft`, `hdg_mag_deg` ← `heading_deg`).

---

## [Unreleased] - ST-911 - YYYY-MM-DD
- Update: Telemetry parser synced to V5 schema. Added unit and integration tests (telemetry-parser.spec.ts, smoke_v5_csv_test.ts).
- Impact: Parsing updated to accept V5 recorder output. No changes to scoring logic expected. Orchestrator ACK required for merge.
- Test vectors: s2s_telemetry_20260511_173825.csv, s2s_telemetry_20260511_204358.csv

- ID: ST-804 | Date: 2026-05-13T17:16:08.235682Z | Author: Miles (CFI Advisor)
  - Files changed: S2S_DEBRIEF_SCHEMA_v2.json, debrief_173825_v2.json, debrief_204358_v2.json
  - Summary: Add s2s_debrief_v2 payload with phase-ordered grading, weighted objectives, and sequence_log for full-flight visibility.
  - Risk: Mid (schema extension)
  - Why: Provide instructors full-flight context to correlate upstream issues to landing outcomes.
  - Acceptance: See ST-804_test_plan.md
  - Revert plan: Remove s2s_debrief_v2 emitter and preserve legacy_debrief.
