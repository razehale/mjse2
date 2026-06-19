/**
 * ST-912 (A/B) + BL-202 regression tests
 * Run: npx tsx tests/st912-bl202-regression.test.ts
 */

import { loadTelemetry, col, __telemetryParserInternals } from '../lib/s2s-engine/telemetry-parser';
import { detectPhases } from '../lib/s2s-engine/phase-detector';
import { evaluateFlight } from '../lib/s2s-engine';

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

function buildCsv(headers: string[], rows: Array<Array<string | number>>): string {
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

console.log('\n🧪 ST-912 + BL-202 Regression Suite');
console.log('='.repeat(64));

// ------------------------------------------------------------
// 1) Parser robustness: CSV mapping + token parsing + separator
// ------------------------------------------------------------
console.log('\n1) Parser maps ias_kts/gs_kts and parses quoted/spaced numeric tokens');
{
  const csv = [
    't_sec,ias_kts,gs_kts,on_ground,alt_agl_ft,alt_msl_ft,vs_fpm,hdg_mag_deg',
    '0," 0 "," 0 ","1",0,882,0,240',
    '1," 55.5 "," 58.2 "," 0.49 ",12,894,700,240',
    '2,"65.2", "67.1", "0.51", 30, 912, -120, 240',
  ].join('\n');

  const parsed = __telemetryParserInternals.parseCsvText(csv);
  assert(parsed.separator === ',', 'Separator detected as comma');
  assert(parsed.headers.includes('ias_kts') && parsed.headers.includes('gs_kts'), 'Headers include V5 speed columns');

  const { dataframe: df } = loadTelemetry(csv, 0);
  const ias = col(df, 'ias');
  const gs = col(df, 'gs');
  const onGround = col(df, 'on_ground');

  assert(Math.max(...ias) > 60, `IAS mapped from ias_kts (max=${Math.max(...ias).toFixed(1)})`);
  assert(Math.max(...gs) > 60, `GS mapped from gs_kts (max=${Math.max(...gs).toFixed(1)})`);
  assert(onGround[1] === 0 && onGround[2] === 1, 'on_ground normalized with 0.5 threshold (0.49→0, 0.51→1)');
}

// ------------------------------------------------------------
// 2) on_ground transitions + VS/AGL sign normalization
// ------------------------------------------------------------
console.log('\n2) on_ground normalization yields takeoff/landing; VS sign is corrected for descent');
{
  const headers = ['t_sec', 'ias_kts', 'gs_kts', 'on_ground', 'alt_agl_ft', 'alt_msl_ft', 'vs_fpm', 'hdg_mag_deg'];
  const rows: Array<Array<string | number>> = [];

  for (let t = 0; t <= 12; t++) {
    const onGroundRaw = t <= 1 ? 0.98 : (t >= 10 ? 0.97 : 0.02);
    const altAgl = t <= 2 ? 0 : Math.max(0, 400 - (t - 2) * 55);

    // Intentionally inverted sign while descending (positive in descent)
    let vs = 0;
    if (t >= 3 && t <= 8) vs = 500;
    if (t === 9) vs = 380;

    const ias = t <= 1 ? 5 : (t < 10 ? 70 : 40);
    const gs = Math.max(0, ias - 3);

    rows.push([t, ias, gs, onGroundRaw, altAgl, 882 + altAgl, vs, 240]);
  }

  const csv = buildCsv(headers, rows);
  const { dataframe: df } = loadTelemetry(csv, 0);
  const phases = detectPhases(df);

  const takeoff = phases.find(p => p.phase === 'TAKEOFF_ROLL');
  const landing = phases.find(p => p.phase === 'LANDING' || p.phase === 'TOUCH_AND_GO');

  assert(Boolean(takeoff), 'Takeoff transition detected from normalized on_ground');
  assert(Boolean(landing), 'Landing transition detected from normalized on_ground');

  const vs = col(df, 'vs');
  const hasNegativeVs = vs.some(v => v < -100);
  assert(hasNegativeVs, 'VS sign corrected (descent contains negative VS)');

  if (landing) {
    const tdVs = Number(landing.metadata.touchdownVs ?? 0);
    assert(tdVs <= 0, `Touchdown VS is descending (<=0), got ${tdVs}`);
  }
}

// ------------------------------------------------------------
// 3) BL-202: mean_approach_speed_kias populated in scoring output
// ------------------------------------------------------------
console.log('\n3) L2 output includes raw_data.mean_approach_speed_kias');
{
  const headers = ['t_sec', 'ias_kts', 'gs_kts', 'on_ground', 'alt_agl_ft', 'alt_msl_ft', 'vs_fpm', 'hdg_mag_deg', 'flap_ratio', 'pitch_deg', 'elv_trim'];
  const rows: Array<Array<string | number>> = [];

  for (let t = 0; t <= 39; t++) {
    let onGround = 0;
    let ias = 75;
    let gs = 72;
    let altAgl = 700;
    let vs = 0;
    let hdg = 240;
    let flap = 0;
    let pitch = 2;
    let trim = 0.1;

    if (t <= 2) {
      onGround = 1; ias = 10; gs = 8; altAgl = 0; vs = 0; hdg = 240;
    } else if (t <= 8) {
      onGround = 0; ias = 55 + (t - 3) * 3; gs = ias - 3; altAgl = 80 + (t - 3) * 70; vs = 700; hdg = 240;
    } else if (t <= 18) {
      onGround = 0; ias = 90; gs = 87; altAgl = 900; vs = 50; hdg = 60;
    } else if (t <= 23) {
      onGround = 0; ias = 85; gs = 82; altAgl = 780 - (t - 19) * 80; vs = -350; hdg = 150;
    } else if (t <= 35) {
      onGround = 0; ias = 65; gs = 62; altAgl = Math.max(5, 350 - (t - 24) * 30); vs = -320; hdg = 240;
      flap = 0.3 + (t - 24) * 0.03;
      pitch = 1.5;
      trim = 0.12 + (t - 24) * 0.001;
    } else {
      onGround = 1; ias = 40; gs = 35; altAgl = 0; vs = -220; hdg = 240; flap = 0.8;
    }

    rows.push([t, ias, gs, onGround, altAgl, 882 + altAgl, vs, hdg, flap, pitch, trim]);
  }

  const csv = buildCsv(headers, rows);
  const out = evaluateFlight(csv, 'L2', 'synthetic_l2.csv', { machadoQuizPct: 90, resampleHz: 0 });

  const mas = out.result.rawData?.mean_approach_speed_kias;
  assert(typeof mas === 'number', 'raw_data.mean_approach_speed_kias exists as number');
  assert(Number(mas) > 0, `raw_data.mean_approach_speed_kias is populated (>0), got ${mas}`);
}

console.log('\n' + '='.repeat(64));
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
process.exit(0);
