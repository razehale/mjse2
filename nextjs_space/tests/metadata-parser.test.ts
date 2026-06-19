#!/usr/bin/env tsx
// Test script for metadata parsing in telemetry-parser.ts
// Verifies that # metadata lines are correctly extracted

import * as fs from 'fs';
import * as path from 'path';
import { loadTelemetry } from '../lib/s2s-engine/telemetry-parser';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log('🧪 Testing metadata parsing in telemetry-parser.ts\n');

// ─── Test 1: CSV without metadata ────────────────────────────────────
console.log('📋 Test 1: CSV without metadata line');
const csvWithoutMeta = `t_sec,lat,lon,alt_msl_ft,ias_kts,gs_kts
0.0,37.5,-122.0,100.0,0.0,0.0
1.0,37.5,-122.0,102.0,45.0,45.0
2.0,37.5,-122.0,105.0,55.0,55.0`;

const result1 = loadTelemetry(csvWithoutMeta);
assert(result1.dataframe.length > 0, 'DataFrame parsed successfully');
assert(result1.metadata.lesson_tag === undefined, 'No lesson_tag in metadata');
assert(result1.metadata.arc === undefined, 'No arc in metadata');
assert(result1.metadata.recorder_version === undefined, 'No recorder_version in metadata');

// ─── Test 2: CSV with complete metadata ──────────────────────────────
console.log('\n📋 Test 2: CSV with complete metadata line');
const csvWithMeta = `# lesson_tag=L1 arc=1 recorder_version=5
t_sec,lat,lon,alt_msl_ft,ias_kts,gs_kts
0.0,37.5,-122.0,100.0,0.0,0.0
1.0,37.5,-122.0,102.0,45.0,45.0
2.0,37.5,-122.0,105.0,55.0,55.0`;

const result2 = loadTelemetry(csvWithMeta, 0); // resampleHz=0 to skip resampling
assert(result2.dataframe.length === 3, 'DataFrame has 3 rows (no resampling)');
assert(result2.metadata.lesson_tag === 'L1', `lesson_tag = 'L1' (got: ${result2.metadata.lesson_tag})`);
assert(result2.metadata.arc === 1, `arc = 1 (got: ${result2.metadata.arc})`);
assert(result2.metadata.recorder_version === 5, `recorder_version = 5 (got: ${result2.metadata.recorder_version})`);

// ─── Test 3: CSV with partial metadata ───────────────────────────────
console.log('\n📋 Test 3: CSV with partial metadata (only lesson_tag)');
const csvPartialMeta = `# lesson_tag=L3
t_sec,lat,lon,alt_msl_ft,ias_kts,gs_kts
0.0,37.5,-122.0,100.0,0.0,0.0
1.0,37.5,-122.0,102.0,45.0,45.0`;

const result3 = loadTelemetry(csvPartialMeta, 0);
assert(result3.dataframe.length === 2, 'DataFrame has 2 rows (no resampling)');
assert(result3.metadata.lesson_tag === 'L3', `lesson_tag = 'L3' (got: ${result3.metadata.lesson_tag})`);
assert(result3.metadata.arc === undefined, 'arc is undefined when not provided');
assert(result3.metadata.recorder_version === undefined, 'recorder_version is undefined when not provided');

// ─── Test 4: Real golden vector with added metadata ──────────────────
console.log('\n📋 Test 4: Real golden vector (L1_perfect_pass) with added metadata');
const goldenPath = path.join(__dirname, '../tests/golden-vectors/L1_perfect_pass_v5.csv');
if (fs.existsSync(goldenPath)) {
  const originalCsv = fs.readFileSync(goldenPath, 'utf-8');
  const csvWithMetadata = `# lesson_tag=L1 arc=1 recorder_version=5\n${originalCsv}`;
  
  const result4 = loadTelemetry(csvWithMetadata);
  assert(result4.dataframe.length > 50, `DataFrame has sufficient rows (${result4.dataframe.length})`);
  assert(result4.metadata.lesson_tag === 'L1', 'lesson_tag extracted from golden vector');
  assert(result4.metadata.arc === 1, 'arc extracted from golden vector');
  assert(result4.metadata.recorder_version === 5, 'recorder_version extracted from golden vector');
  
  // Verify data integrity - check that IAS values are present
  const iasCol = result4.dataframe.data['ias'];
  assert(iasCol && iasCol.length > 0, 'IAS column present');
  const maxIas = Math.max(...iasCol);
  assert(maxIas > 30, `IAS has realistic flight values (max: ${maxIas.toFixed(1)} kts)`);
} else {
  console.log('⚠️  SKIP: Golden vector file not found');
}

// ─── Test 5: Different metadata formats ──────────────────────────────
console.log('\n📋 Test 5: Metadata with different spacing');
const csvDiffSpacing = `#lesson_tag=L2   arc=2    recorder_version=5
t_sec,lat,lon,alt_msl_ft,ias_kts,gs_kts
0.0,37.5,-122.0,100.0,0.0,0.0`;

const result5 = loadTelemetry(csvDiffSpacing, 0);
assert(result5.metadata.lesson_tag === 'L2', 'lesson_tag parsed with irregular spacing');
assert(result5.metadata.arc === 2, 'arc parsed with irregular spacing');

console.log('\n✨ All metadata parsing tests passed!');
