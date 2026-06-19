/**
 * ST-912 diagnostic tracer
 *
 * Usage:
 *   npx tsx scripts/st912-diagnostic.ts [optional_csv_path]
 */

import * as fs from 'fs';
import * as path from 'path';
import { evaluateFlight } from '../lib/s2s-engine';
import { loadTelemetry, col, __telemetryParserInternals } from '../lib/s2s-engine/telemetry-parser';
import { detectPhases } from '../lib/s2s-engine/phase-detector';

const candidatePaths = [
  process.argv[2],
  '/home/ubuntu/Uploads/s2s_telemetry_20260511_173825.csv',
  '/home/ubuntu/swarm_shared_files/s2s_telemetry_20260511_173825.csv',
  '/home/ubuntu/swarm_shared_files/mjse2/s2s_telemetry_20260511_173825.csv',
].filter(Boolean) as string[];

function firstExistingPath(paths: string[]): string | null {
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function buildSyntheticV5Csv(): string {
  const header = [
    't_sec', 'sim_time', 'lat', 'lon', 'alt_msl_ft', 'alt_agl_ft',
    'ias_kts', 'gs_kts', 'vs_fpm', 'pitch_deg', 'roll_deg', 'hdg_mag_deg',
    'flap_ratio', 'on_ground', 'stall_warn', 'slip_deg',
  ].join(',');

  const rows: string[] = [];
  for (let t = 0; t <= 20; t++) {
    const onGround = t <= 2 ? 1 : (t >= 18 ? 1 : 0);
    const altAgl = t <= 2 ? 0 : Math.max(0, 500 - (t - 3) * 35);
    const ias = t <= 2 ? 8 : (t <= 7 ? 55 + (t - 3) * 3 : (t <= 16 ? 66 : 48));
    const gs = Math.max(0, ias - 2);
    const vs = t <= 2 ? 0 : (t <= 8 ? 600 : (t <= 16 ? -320 : -180));
    const hdg = t <= 10 ? 240 : 240;

    rows.push([
      t,
      t,
      35.0 + t * 0.00001,
      -115.0 + t * 0.00001,
      882 + altAgl,
      altAgl,
      `" ${ias.toFixed(1)} "`,
      `${gs.toFixed(1)}`,
      `${vs}`,
      '2',
      '0',
      `${hdg}`,
      t > 10 ? '0.5' : '0.1',
      `"${onGround}"`,
      '0',
      '0.5',
    ].join(','));
  }

  return [header, ...rows].join('\n');
}

function summarize(csvText: string, label: string): string {
  const parsed = __telemetryParserInternals.parseCsvText(csvText);
  const renamed = __telemetryParserInternals.renameColumns(parsed.headers);

  const { dataframe: df } = loadTelemetry(csvText, 1.0);
  const ias = col(df, 'ias');
  const gs = col(df, 'gs');
  const onGround = col(df, 'on_ground');
  const vs = col(df, 'vs');
  const altAgl = col(df, 'alt_agl');
  const phases = detectPhases(df);

  const firstLanding = phases.find(p => p.phase === 'LANDING' || p.phase === 'TOUCH_AND_GO');
  const engine = evaluateFlight(csvText, 'L2', `${label}.csv`, { machadoQuizPct: 90 });

  const sep = parsed.separator === ',' ? 'comma' : 'pipe';
  const onGroundValues = Array.from(new Set(onGround)).sort((a, b) => a - b).join(', ');
  const tdVs = firstLanding?.metadata?.touchdownVs;

  return [
    `### Dataset: ${label}`,
    `- parseCsvText separator detected: **${sep}**`,
    `- Header count: **${parsed.headers.length}**`,
    `- Row count after parser cleanup: **${parsed.dataRows.length}**`,
    `- COL_MAP rename checks: ias_kts→${renamed[parsed.headers.indexOf('ias_kts')] ?? 'N/A'}, gs_kts→${renamed[parsed.headers.indexOf('gs_kts')] ?? 'N/A'}`,
    `- IAS max: **${Math.max(...ias).toFixed(2)}**`,
    `- GS max: **${Math.max(...gs).toFixed(2)}**`,
    `- on_ground unique values post-normalization: **${onGroundValues}**`,
    `- VS min/max: **${Math.min(...vs).toFixed(2)} / ${Math.max(...vs).toFixed(2)}**`,
    `- AGL min/max: **${Math.min(...altAgl).toFixed(2)} / ${Math.max(...altAgl).toFixed(2)}**`,
    `- Detected phases: **${phases.map(p => p.phase).join(', ') || 'none'}**`,
    `- First touchdown VS: **${tdVs != null ? tdVs : 'N/A'}**`,
    `- L2 raw_data.mean_approach_speed_kias: **${engine.result.rawData?.mean_approach_speed_kias ?? 'N/A'}**`,
    `- L2 overall score: **${engine.result.overallScore} (${engine.result.overallGrade})**`,
    '',
  ].join('\n');
}

const realCsvPath = firstExistingPath(candidatePaths);
const syntheticCsv = buildSyntheticV5Csv();

const sections: string[] = [];
sections.push('# ST-912 Diagnostic Findings');
sections.push('');
sections.push(`Generated at: ${new Date().toISOString()}`);
sections.push('');
sections.push('## Scope');
sections.push('- Verified CSV ingestion path: parser tokenization, separator detection, COL_MAP rename, numeric parse, normalization, and engine scoring entry.');
sections.push('- Inspected code path from `app/api/sessions/route.ts` to `evaluateFlight(csvContent, ...)`.');
sections.push('');

if (realCsvPath) {
  const realCsv = fs.readFileSync(realCsvPath, 'utf-8');
  sections.push(`## Real CSV probe`);
  sections.push(`- Source file: \`${realCsvPath}\``);
  sections.push('');
  sections.push(summarize(realCsv, 'real_v5_csv'));
} else {
  sections.push('## Real CSV probe');
  sections.push('- No real CSV found in known paths inside this VM.');
  sections.push('');
}

sections.push('## Synthetic V5 probe');
sections.push('');
sections.push(summarize(syntheticCsv, 'synthetic_v5_csv'));

sections.push('## Sessions route handoff check');
sections.push('- `app/api/sessions/route.ts` reads `csvContent` from request JSON and passes it directly to `evaluateFlight(csvContent, lessonKey, ...)` and `loadTelemetry(csvContent, 1.0)`.');
sections.push('- No transformation layer in between that would strip IAS/GS columns.');
sections.push('');
sections.push('## Deployment mismatch hypothesis');
sections.push('- If production still shows IAS=0 while local parser shows non-zero IAS for same file, likely cause is stale deployment build or old artifact served in environment.');
sections.push('- Recommended proof step: log parser fingerprint/version and row-level IAS sample in runtime handling uploads, then compare deployed commit SHA with local HEAD.');

const outPath = '/home/ubuntu/swarm_shared_files/ST-912_DIAGNOSTIC_FINDINGS.md';
fs.writeFileSync(outPath, sections.join('\n'));

console.log(`Diagnostic report written to: ${outPath}`);
