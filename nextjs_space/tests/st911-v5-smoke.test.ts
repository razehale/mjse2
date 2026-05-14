/**
 * ST-911 Smoke Test — V5 Telemetry Schema Compatibility
 *
 * Loads a real V5 CSV through the scoring engine (evaluateFlight)
 * and verifies that:
 *   1. The CSV parses without errors
 *   2. Critical renamed columns (alt_msl_ft, alt_agl_ft, hdg_mag_deg) map correctly
 *   3. New V5 columns (recorder_version, rep_magneto, etc.) are present in the dataframe
 *   4. evaluateFlight() returns a valid result with non-zero altitude data
 *
 * Run: npx tsx tests/st911-v5-smoke.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { evaluateFlight } from '../lib/s2s-engine/index';
import { loadTelemetry, col } from '../lib/s2s-engine/telemetry-parser';

const CSV_PATH = '/home/ubuntu/Uploads/s2s_telemetry_20260511_173825.csv';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${label}`);
    failed++;
  }
}

// ─── Load CSV ────────────────────────────────────────────────────────
console.log('\n🔧 ST-911 V5 Telemetry Smoke Test');
console.log('─'.repeat(60));

const csvText = fs.readFileSync(CSV_PATH, 'utf-8');
assert(csvText.length > 1000, `CSV loaded (${(csvText.length / 1024).toFixed(0)} KB)`);

// ─── Test 1: s2s-engine parser (loadTelemetry) ──────────────────────
console.log('\n📊 Test 1: s2s-engine/telemetry-parser (loadTelemetry)');
const df = loadTelemetry(csvText);
assert(df.length > 0, `DataFrame has ${df.length} rows`);

// Critical renames must map correctly
const altMsl = col(df, 'alt_msl');
const altAgl = col(df, 'alt_agl');
const hdg = col(df, 'hdg');

assert(altMsl.length === df.length, `alt_msl column present (${altMsl.length} values)`);
assert(altAgl.length === df.length, `alt_agl column present (${altAgl.length} values)`);
assert(hdg.length === df.length, `hdg column present (${hdg.length} values)`);

// Verify these aren't all zeros (the bug ST-911 fixes)
const maxAltMsl = Math.max(...altMsl);
const maxAltAgl = Math.max(...altAgl);
const maxHdg = Math.max(...hdg);

assert(maxAltMsl > 0, `alt_msl has real data (max: ${maxAltMsl.toFixed(1)} ft)`);
assert(maxAltAgl > 0, `alt_agl has real data (max: ${maxAltAgl.toFixed(1)} ft)`);
assert(maxHdg > 0, `hdg has real data (max: ${maxHdg.toFixed(1)} deg)`);

// New V5 columns should be parsed
const recorderVersion = col(df, 'recorder_version');
const repMagneto = col(df, 'rep_magneto');
const hdgTrue = col(df, 'hdg_true');
const beta = col(df, 'beta');
const repPreheat = col(df, 'rep_preheat');

assert(recorderVersion.length === df.length, `recorder_version column present`);
assert(repMagneto.length === df.length, `rep_magneto column present`);
assert(hdgTrue.length === df.length, `hdg_true column present`);
assert(beta.length === df.length, `beta column present`);
assert(repPreheat.length === df.length, `rep_preheat column present`);

// ─── Test 2: Canonical parser — summary-equivalent checks ──────────
console.log('\n📊 Test 2: s2s-engine/telemetry-parser summary validation');
const tArr = col(df, 't');
const durationSec = tArr.length > 1 ? tArr[tArr.length - 1] - tArr[0] : 0;
assert(df.length > 0, `Parsed ${df.length} rows via canonical parser`);
assert(durationSec > 0, `Duration: ${durationSec.toFixed(0)}s`);

// V5 renamed columns resolved to canonical internal names
assert(df.data['alt_msl'] !== undefined, `alt_msl column exists in DataFrame`);
assert(df.data['alt_agl'] !== undefined, `alt_agl column exists in DataFrame`);
assert(df.data['hdg'] !== undefined, `hdg column exists in DataFrame`);

// Summary-equivalent: max altitude checks
assert(maxAltMsl > 0, `Summary maxAltMsl: ${maxAltMsl.toFixed(1)}`);
assert(maxAltAgl > 0, `Summary maxAltAgl: ${maxAltAgl.toFixed(1)}`);

// ─── Test 3: evaluateFlight() end-to-end ────────────────────────────
console.log('\n📊 Test 3: evaluateFlight() end-to-end (L2 lesson)');
const result = evaluateFlight(csvText, 'L2', 's2s_telemetry_20260511_173825.csv', {
  studentId: 'smoke-test',
  machadoQuizPct: 80,
});

assert(result.result !== null && result.result !== undefined, 'evaluateFlight returned a result');
assert(typeof result.json === 'object', 'JSON output is an object');
assert(typeof result.html === 'string' && result.html.length > 0, `HTML output generated (${result.html.length} chars)`);
assert(result.result.lessonId !== undefined, `Lesson: ${result.result.lessonId}`);
assert(result.result.overallScore !== undefined, `Overall score: ${result.result.overallScore}`);

// ─── Summary ────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`\n🏁 Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\n⚠️  SOME TESTS FAILED — review output above');
  process.exit(1);
} else {
  console.log('\n✅ All tests passed — V5 schema compatibility confirmed');
  process.exit(0);
}
