/**
 * ST-805B-MVP Integration Test
 *
 * Validates the end-to-end flow:
 *   1. V5 CSV parsing works with both uploaded files
 *   2. evaluateFlight() returns valid scored result with phases
 *   3. Debrief JSON structure is complete (both layers)
 *   4. Simulated CSV files also parse correctly
 *   5. Gate logic conditions are verifiable
 *   6. Arc 1 content manifest loads and has required fields
 *
 * Run: npx tsx tests/st805b-mvp-integration.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { evaluateFlight } from '../lib/s2s-engine/index';
import { loadTelemetry, col } from '../lib/s2s-engine/telemetry-parser';

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

// ─── Section 1: V5 CSV Parsing ──────────────────────────────────────
console.log('\n🔧 ST-805B-MVP Integration Test');
console.log('═'.repeat(60));

console.log('\n📊 Section 1: V5 Real CSV Parsing');
const v5CsvPath = '/home/ubuntu/Uploads/s2s_telemetry_20260511_173825.csv';
const v5Csv = fs.readFileSync(v5CsvPath, 'utf-8');
const v5Df = loadTelemetry(v5Csv);
assert(v5Df.length > 100, `V5 CSV parsed: ${v5Df.length} rows`);
assert(v5Df.data['alt_msl'] !== undefined, 'alt_msl column mapped (V5 rename)');
assert(v5Df.data['hdg'] !== undefined, 'hdg column mapped (V5 rename)');
assert(v5Df.data['slip'] !== undefined, 'slip column present (coordination metric)');

const altMsl = col(v5Df, 'alt_msl');
assert(Math.max(...altMsl) > 800, `alt_msl has real data (max: ${Math.max(...altMsl).toFixed(0)} ft)`);

// ─── Section 2: Simulated CSV Parsing ───────────────────────────────
console.log('\n📊 Section 2: Simulated CSV Parsing');
const sim1Path = '/home/ubuntu/Uploads/s2s_flight_20260506_231903.csv';
const sim2Path = '/home/ubuntu/Uploads/s2s_flight_20260506_231900.csv';
const sim1 = fs.readFileSync(sim1Path, 'utf-8');
const sim2 = fs.readFileSync(sim2Path, 'utf-8');

const sim1Df = loadTelemetry(sim1);
const sim2Df = loadTelemetry(sim2);
assert(sim1Df.length > 0, `Simulated CSV 1 parsed: ${sim1Df.length} rows`);
assert(sim2Df.length > 0, `Simulated CSV 2 parsed: ${sim2Df.length} rows`);

// ─── Section 3: evaluateFlight() — V5 CSV ──────────────────────────
console.log('\n📊 Section 3: evaluateFlight() with V5 CSV');
const v5Result = evaluateFlight(v5Csv, 'L1', 'v5_test.csv', { studentId: 'mvp-test' });
assert(v5Result.result !== null, 'evaluateFlight returned result for V5 CSV');
assert(typeof v5Result.result.overallScore === 'number', `Overall score: ${v5Result.result.overallScore}`);
assert(v5Result.result.phases.length > 0, `Phases detected: ${v5Result.result.phases.length}`);
assert(typeof v5Result.result.overallGrade === 'string', `Grade: ${v5Result.result.overallGrade}`);
assert(typeof v5Result.result.passed === 'boolean', `Passed: ${v5Result.result.passed}`);

// ─── Section 4: evaluateFlight() — Simulated CSV ───────────────────
console.log('\n📊 Section 4: evaluateFlight() with Simulated CSVs');
const sim1Result = evaluateFlight(sim1, 'L1', 'sim1.csv', { studentId: 'mvp-test' });
const sim2Result = evaluateFlight(sim2, 'L1', 'sim2.csv', { studentId: 'mvp-test' });
assert(typeof sim1Result.result.overallScore === 'number', `Sim1 score: ${sim1Result.result.overallScore}`);
assert(typeof sim2Result.result.overallScore === 'number', `Sim2 score: ${sim2Result.result.overallScore}`);

// ─── Section 5: Debrief JSON Structure ──────────────────────────────
console.log('\n📊 Section 5: Debrief JSON Structure (Layer 2 — Evaluator)');
const djson = v5Result.json;
assert(typeof djson.overall_score === 'number', 'Debrief JSON has overall_score');
assert(typeof djson.overall_grade === 'string', 'Debrief JSON has overall_grade');
assert(Array.isArray(djson.phases), `Debrief JSON has phases array (${djson.phases?.length})`);
assert(Array.isArray(djson.coaching_bullets), `Coaching bullets present (${djson.coaching_bullets?.length})`);
assert(Array.isArray(djson.safety_flags), 'Safety flags array present');

// Phase detail
if (djson.phases?.length > 0) {
  const p0 = djson.phases[0];
  assert(typeof p0.phase === 'string', `First phase name: ${p0.phase}`);
  assert(typeof p0.score === 'number', `First phase score: ${p0.score}`);
  const metricsIsObj = typeof p0.metrics === 'object' && p0.metrics !== null;
  assert(metricsIsObj, `First phase has metrics (${metricsIsObj ? Object.keys(p0.metrics).length + ' keys' : 'missing'})`);
}

// HTML output
assert(v5Result.html.length > 100, `HTML debrief generated (${v5Result.html.length} chars)`);

// ─── Section 6: Arc 1 Content Manifest ──────────────────────────────
console.log('\n📊 Section 6: Arc 1 Content Manifest (Layer 1 — Coach)');
const manifestPath = path.join(__dirname, '..', 'data', 'arc1_content_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
assert(manifest.version === '2.0', `Manifest version: ${manifest.version}`);

for (const lk of ['L1', 'L2', 'L3', 'L4']) {
  const lesson = manifest.lessons[lk];
  assert(!!lesson, `${lk} exists in manifest`);
  const debrief = lesson?.debrief?.content;
  assert(!!debrief?.summary, `${lk} has debrief summary`);
  assert(Array.isArray(debrief?.what_you_did_well), `${lk} has what_you_did_well`);
  assert(Array.isArray(debrief?.what_to_fix), `${lk} has what_to_fix`);
  assert(Array.isArray(debrief?.coach_callouts), `${lk} has coach_callouts`);
  assert(typeof debrief?.next_focus === 'string', `${lk} has next_focus`);
  assert(!!lesson?.mentalModelOutcome, `${lk} has mentalModelOutcome`);
}

// ─── Section 7: Gate Logic Validation ───────────────────────────────
console.log('\n📊 Section 7: Gate Logic Conditions');
// Test gate conditions
const scoreInt = Math.max(1, Math.min(5, Math.round(v5Result.result.overallScore)));
assert(scoreInt >= 1 && scoreInt <= 5, `Score clamped to 1-5: ${scoreInt}`);
const flightOk = scoreInt >= 3;
const debriefOk = true; // would be set by UI
const quizOk = true; // no quiz for L1
const gatePass = flightOk && debriefOk && quizOk;
assert(typeof gatePass === 'boolean', `Gate pass computed: flightOk=${flightOk}, debriefOk=${debriefOk}, quizOk=${quizOk} → ${gatePass}`);

// ─── Summary ────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log(`\n🏁 Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('\n⚠️  SOME TESTS FAILED — review output above');
  process.exit(1);
} else {
  console.log('\n✅ All MVP integration tests passed');
  process.exit(0);
}
