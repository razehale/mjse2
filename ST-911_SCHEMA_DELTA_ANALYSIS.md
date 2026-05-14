# ST-911 Schema Delta Analysis
## V5 Telemetry CSV → Current Parser Gap Report

**Date**: 2026-05-14  
**Source CSVs**: `s2s_telemetry_20260511_173825.csv`, `s2s_telemetry_20260511_204358.csv`  
**Both CSVs have identical 70-column headers.**

---

## 1. Column Renames (BREAKING — parser will silently drop these columns)

| V4 COL_MAP Key | V5 CSV Header | Internal Name | Impact |
|---|---|---|---|
| `alt_msl` | `alt_msl_ft` | `alt_msl` | **CRITICAL** — used by phase-detector, arc1-grader, go-around. Currently maps to nothing → all altitude checks get zeros. |
| `alt_agl` | `alt_agl_ft` | `alt_agl` | **CRITICAL** — used everywhere for AGL thresholds. Same zero-fill problem. |
| `hdg_deg` | `hdg_mag_deg` | `hdg` | **CRITICAL** — all heading-based pattern detection (downwind, base, final, crosswind) uses `col(df, 'hdg')`. Gets zeros. |

### Fix Required
Add V5 aliases to `COL_MAP`:
```ts
alt_msl_ft: 'alt_msl',   // V5 rename
alt_agl_ft: 'alt_agl',   // V5 rename
hdg_mag_deg: 'hdg',      // V5 rename (magnetic heading)
```

---

## 2. New V5 Columns NOT in COL_MAP (need to be added)

| V5 CSV Header | Suggested Internal Name | Used By | Priority |
|---|---|---|---|
| `hdg_true_deg` | `hdg_true` | Not currently used, but useful for future nav scoring | LOW |
| `beta_deg` | `beta` | Sideslip angle — potential slip/skid scoring | LOW |
| `rep_preheat` | `rep_preheat` | REP engine state for preflight checks | MEDIUM |
| `rep_plug_fouling` | `rep_plug_fouling` | REP engine state — runup grading | MEDIUM |
| `rep_primer` | `rep_primer` | REP engine start procedure | MEDIUM |
| `rep_magneto` | `rep_magneto` | REP magneto check — runup grading | MEDIUM |
| `recorder_version` | `recorder_version` | Schema version detection (per LOGIC_DELTA) | HIGH |

### Fix Required
Add these to `COL_MAP`:
```ts
hdg_true_deg: 'hdg_true',
beta_deg: 'beta',
rep_preheat: 'rep_preheat',
rep_plug_fouling: 'rep_plug_fouling',
rep_primer: 'rep_primer',
rep_magneto: 'rep_magneto',
recorder_version: 'recorder_version',
```

---

## 3. `lib/telemetry-parser.ts` (ST-505 legacy parser) — Additional Gaps

This older parser uses `EXPECTED_COLUMNS` with **different naming conventions** that don't match V5:

| EXPECTED_COLUMNS Entry | V5 CSV Header | Status |
|---|---|---|
| `alt_msl` | `alt_msl_ft` | ❌ MISSING — needs alias |
| `alt_agl` | `alt_agl_ft` | ❌ MISSING — needs alias |
| `hdg_deg` | `hdg_mag_deg` | ❌ MISSING — needs alias |
| `beacon_on` | `light_beacon` | ❌ Name mismatch |
| `avionics_on` | `rep_avionics` | ❌ Name mismatch |

Many V5 columns (REP engine params, head_roll, wind, lights, etc.) are completely absent from `EXPECTED_COLUMNS`.

### Fix Required
Update `EXPECTED_COLUMNS` to use V5 names OR add a column-alias normalization step before lookup.

---

## 4. `types/telemetry.ts` — TelemetryRow Interface Gaps

The `TelemetryRow` interface is missing many V5 fields and uses stale names:

| Interface Field | V5 CSV Header | Status |
|---|---|---|
| `alt_msl` | `alt_msl_ft` | ❌ Stale name |
| `alt_agl` | `alt_agl_ft` | ❌ Stale name |
| `hdg_deg` | `hdg_mag_deg` | ❌ Stale name |
| `beacon_on` | `light_beacon` | ❌ Stale name |
| `avionics_on` | `rep_avionics` | ❌ Stale name |
| Missing: `alpha_deg`, `beta_deg`, `carb_heat`, `flap_handle_dep`, `fuel_total_kg`, `g_side`, `gear_deflect_mtr`, `generator_on`, `head_roll`, `towbar`, `wind_spd_kt`, `wind_dir_deg`, `rep_*` fields, `recorder_version` | — | ❌ Not in interface |

### Fix Required
Expand `TelemetryRow` to include all 70 V5 columns with correct naming.

---

## 5. Downstream Consumer Impact

All downstream files reference internal names via `col(df, 'name')`. As long as `COL_MAP` maps V5 headers → existing internal names, **no downstream changes are needed** for the 3 critical renames:

| File | References | Impact After COL_MAP Fix |
|---|---|---|
| `phase-detector.ts` | `alt_agl`, `alt_msl`, `hdg` | ✅ No change needed |
| `arc1-grader.ts` | `alt_agl`, `alt_msl`, `hdg` | ✅ No change needed |
| `landing-scorer.ts` | `gear_deflect` | ✅ Already mapped |
| `go-around.ts` | `alt_agl`, `hdg` | ✅ No change needed |
| `gtgl-sequence-detector.ts` | `hdg` (via metadata) | ✅ No change needed |

---

## 6. Summary of Required Changes (ST-911 Scope)

### Priority 1 — CRITICAL (parser breaks without these)
1. **`lib/s2s-engine/telemetry-parser.ts` COL_MAP**: Add 3 V5 renames (`alt_msl_ft`, `alt_agl_ft`, `hdg_mag_deg`)
2. **`lib/s2s-engine/telemetry-parser.ts` COL_MAP**: Add 7 new V5 columns (`hdg_true_deg`, `beta_deg`, `rep_preheat`, `rep_plug_fouling`, `rep_primer`, `rep_magneto`, `recorder_version`)

### Priority 2 — TYPE SAFETY
3. **`types/telemetry.ts`**: Update `TelemetryRow` interface to match V5 schema
4. **`lib/telemetry-parser.ts`**: Update `EXPECTED_COLUMNS` to include V5 column names

### Priority 3 — TESTING (per ST-911 ticket)
5. **Unit tests**: Verify V5 CSV headers parse without errors
6. **Integration smoke test**: Full `evaluateFlight()` pass with sample CSVs
7. **`PROJECT_CHANGELOG.md`**: Append v1.0.1-beta entry

---

## 7. Backward Compatibility Note

The V5 COL_MAP additions are **additive** — existing V4 keys (`alt_msl`, `alt_agl`, `hdg_deg`) should be **kept** in `COL_MAP` so older CSV files still parse correctly. The parser maps whichever header it finds first.
