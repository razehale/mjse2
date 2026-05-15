/**
 * ST-805C Unit Tests: Ball-Centered Coordination Scoring
 * Run: npx tsx lib/s2s-engine/__tests__/ball-centered-scoring.test.ts
 */

import { TelemetryDataFrame, col } from '../telemetry-parser';
import { FlightPhase } from '../phase-detector';
import { scoreBallCenteredClimb, scoreBallCenteredSlowFlight } from '../arc1-grader';
import {
  BALL_CENTERED_CLIMB_TOLERANCE_DEG,
  BALL_CENTERED_SLOW_FLIGHT_TOLERANCE_DEG,
} from '../constants';

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg}`);
    failed++;
  }
}

function assertApprox(actual: number, expected: number, tolerance: number, msg: string) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  ✅ ${msg} (got ${actual}, expected ~${expected})`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${msg} (got ${actual}, expected ~${expected} ±${tolerance})`);
    failed++;
  }
}

// Helper to build a minimal TelemetryDataFrame
function buildDf(rows: Array<{ slip: number; vs: number; ias: number; on_ground: number }>): TelemetryDataFrame {
  const data: Record<string, number[]> = {
    t: [], slip: [], vs: [], ias: [], on_ground: [],
    alt_agl: [], alt_msl: [], hdg: [], lat: [], lon: [],
    gs: [], pitch: [], roll: [], flap_ratio: [], elv_trim: [],
    throttle: [], rpm: [], mp: [], parking_brake: [], g_normal: [],
    stall_warn: [], aileron: [], elevator: [], rudder: [], mixture: [],
  };
  for (let i = 0; i < rows.length; i++) {
    data.t.push(i);
    data.slip.push(rows[i].slip);
    data.vs.push(rows[i].vs);
    data.ias.push(rows[i].ias);
    data.on_ground.push(rows[i].on_ground);
    data.alt_agl.push(1000);
    data.alt_msl.push(2000);
    data.hdg.push(240);
    data.lat.push(33.39);
    data.lon.push(-84.33);
    data.gs.push(rows[i].ias);
    data.pitch.push(5);
    data.roll.push(0);
    data.flap_ratio.push(0);
    data.elv_trim.push(0);
    data.throttle.push(0.8);
    data.rpm.push(2400);
    data.mp.push(25);
    data.parking_brake.push(0);
    data.g_normal.push(1);
    data.stall_warn.push(0);
    data.aileron.push(0);
    data.elevator.push(0);
    data.rudder.push(0);
    data.mixture.push(1);
  }
  const columns = Object.keys(data);
  return { columns, data, length: rows.length } as TelemetryDataFrame;
}

function buildPhases(name: string, startIdx: number, endIdx: number): FlightPhase[] {
  return [{
    phase: name, startIdx, endIdx,
    startT: startIdx, endT: endIdx,
    metadata: {},
  }];
}

// ─── Tests ───────────────────────────────────────────────────────────

console.log('\n=== ST-805C Ball-Centered Scoring Unit Tests ===\n');

// --- Constants ---
console.log('1. Constants');
assert(BALL_CENTERED_CLIMB_TOLERANCE_DEG === 3.0, 'BALL_CENTERED_CLIMB_TOLERANCE_DEG = 3.0');
assert(BALL_CENTERED_SLOW_FLIGHT_TOLERANCE_DEG === 4.0, 'BALL_CENTERED_SLOW_FLIGHT_TOLERANCE_DEG = 4.0');

// --- scoreBallCenteredClimb ---
console.log('\n2. scoreBallCenteredClimb');

// 2a. Perfect coordination (0° slip during climb)
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 0, vs: 500, ias: 74, on_ground: 0 }));
  const df = buildDf(rows);
  const phases = buildPhases('INITIAL_CLIMB', 0, 29);
  const result = scoreBallCenteredClimb(df, phases);
  assert(result !== null, '2a: Returns result for perfect coordination');
  assert(result!.score === 5, '2a: Perfect coordination scores 5');
  assert(result!.name === 'ball_centered_climb', '2a: Metric name correct');
  assertApprox(result!.value, 0, 0.01, '2a: Mean slip is 0');
}

// 2b. Moderate slip (2° average, within tolerance)
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 2.0, vs: 500, ias: 74, on_ground: 0 }));
  const df = buildDf(rows);
  const phases = buildPhases('CLIMB', 0, 29);
  const result = scoreBallCenteredClimb(df, phases);
  assert(result !== null, '2b: Returns result for moderate slip');
  assert(result!.score >= 4, '2b: 2° slip within 3° tolerance scores ≥4');
}

// 2c. Heavy slip (6° average, outside tolerance)
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 6.0, vs: 500, ias: 74, on_ground: 0 }));
  const df = buildDf(rows);
  const phases = buildPhases('CLIMB', 0, 29);
  const result = scoreBallCenteredClimb(df, phases);
  assert(result !== null, '2c: Returns result for heavy slip');
  assert(result!.score <= 2, '2c: 6° slip scores ≤2 (poor coordination)');
}

// 2d. No climb data → null
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 0, vs: -200, ias: 74, on_ground: 0 }));
  const df = buildDf(rows);
  const phases: FlightPhase[] = [];
  const result = scoreBallCenteredClimb(df, phases);
  assert(result === null, '2d: Returns null when no climb detected');
}

// 2e. On-ground samples ignored
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 10, vs: 500, ias: 74, on_ground: 1 }));
  const df = buildDf(rows);
  const phases = buildPhases('CLIMB', 0, 29);
  const result = scoreBallCenteredClimb(df, phases);
  assert(result === null, '2e: Returns null when all samples are on-ground');
}

// 2f. Fallback to VS-based detection (no named climb phase)
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 1.0, vs: 500, ias: 74, on_ground: 0 }));
  const df = buildDf(rows);
  const phases: FlightPhase[] = []; // No climb phases detected
  const result = scoreBallCenteredClimb(df, phases);
  assert(result !== null, '2f: Fallback detects climb via VS > 200');
  assert(result!.score >= 4, '2f: Good coordination via fallback scores ≥4');
}

// 2g. Mixed slip (some within, some outside tolerance)
{
  const rows: Array<{ slip: number; vs: number; ias: number; on_ground: number }> = [];
  for (let i = 0; i < 20; i++) rows.push({ slip: 1.0, vs: 500, ias: 74, on_ground: 0 }); // 20 good
  for (let i = 0; i < 10; i++) rows.push({ slip: 8.0, vs: 500, ias: 74, on_ground: 0 }); // 10 bad
  const df = buildDf(rows);
  const phases = buildPhases('CLIMB', 0, 29);
  const result = scoreBallCenteredClimb(df, phases);
  assert(result !== null, '2g: Mixed slip returns result');
  assert(result!.score >= 2 && result!.score <= 4, '2g: Mixed slip scores between 2-4');
}

// --- scoreBallCenteredSlowFlight ---
console.log('\n3. scoreBallCenteredSlowFlight');

// 3a. Perfect coordination during slow flight
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 0, vs: 0, ias: 52, on_ground: 0 }));
  const df = buildDf(rows);
  const phases = buildPhases('SLOW_FLIGHT', 0, 29);
  const result = scoreBallCenteredSlowFlight(df, phases);
  assert(result !== null, '3a: Returns result for perfect slow flight coordination');
  assert(result!.score === 5, '3a: Perfect coordination scores 5');
  assert(result!.name === 'ball_centered_slow_flight', '3a: Metric name correct');
}

// 3b. Moderate slip within 4° tolerance
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 3.0, vs: 0, ias: 52, on_ground: 0 }));
  const df = buildDf(rows);
  const phases = buildPhases('SLOW_FLIGHT', 0, 29);
  const result = scoreBallCenteredSlowFlight(df, phases);
  assert(result !== null, '3b: Returns result');
  assert(result!.score >= 4, '3b: 3° slip within 4° tolerance scores ≥4');
}

// 3c. Heavy slip during slow flight
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 8.0, vs: 0, ias: 52, on_ground: 0 }));
  const df = buildDf(rows);
  const phases = buildPhases('SLOW_FLIGHT', 0, 29);
  const result = scoreBallCenteredSlowFlight(df, phases);
  assert(result !== null, '3c: Returns result for heavy slip');
  assert(result!.score <= 2, '3c: 8° slip scores ≤2');
}

// 3d. No slow flight data → null
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 0, vs: 0, ias: 120, on_ground: 0 }));
  const df = buildDf(rows);
  const phases: FlightPhase[] = [];
  const result = scoreBallCenteredSlowFlight(df, phases);
  assert(result === null, '3d: Returns null when no slow flight detected');
}

// 3e. Fallback to IAS-based detection
{
  const rows = Array.from({ length: 30 }, () => ({ slip: 2.0, vs: 0, ias: 50, on_ground: 0 }));
  const df = buildDf(rows);
  const phases: FlightPhase[] = []; // No SLOW_FLIGHT phases
  const result = scoreBallCenteredSlowFlight(df, phases);
  assert(result !== null, '3e: Fallback detects slow flight via IAS < 60');
  assert(result!.score >= 4, '3e: Good coordination via fallback scores ≥4');
}

// --- Negative slip values (left slip) ---
console.log('\n4. Negative slip handling');
{
  const rows = Array.from({ length: 30 }, () => ({ slip: -2.0, vs: 500, ias: 74, on_ground: 0 }));
  const df = buildDf(rows);
  const phases = buildPhases('CLIMB', 0, 29);
  const result = scoreBallCenteredClimb(df, phases);
  assert(result !== null, '4a: Handles negative slip values');
  assertApprox(result!.value, 2.0, 0.01, '4a: Absolute value used (2.0)');
}

// --- Score range validation ---
console.log('\n5. Score range validation');
{
  // Scores should always be 1-5
  const extremes = [0, 0.1, 1, 2, 3, 5, 10, 20, 45];
  for (const slipVal of extremes) {
    const rows = Array.from({ length: 10 }, () => ({ slip: slipVal, vs: 500, ias: 74, on_ground: 0 }));
    const df = buildDf(rows);
    const phases = buildPhases('CLIMB', 0, 9);
    const result = scoreBallCenteredClimb(df, phases);
    if (result) {
      assert(result.score >= 1.0 && result.score <= 5.0, `5: Score ${result.score} in range [1,5] for slip=${slipVal}°`);
    }
  }
}

// --- Summary ---
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failed > 0) {
  console.error('\n❌ SOME TESTS FAILED');
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED');
}
