#!/usr/bin/env tsx
// Integration test: Verify evaluateFlight returns metadata correctly

import * as fs from 'fs';
import * as path from 'path';
import { evaluateFlight } from '../lib/s2s-engine';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log('🧪 Integration Test: evaluateFlight with metadata\n');

// ─── Test 1: evaluateFlight without metadata ─────────────────────────
console.log('📋 Test 1: evaluateFlight without metadata in CSV');
const csvNoMeta = `t_sec,lat,lon,alt_msl_ft,ias_kts,gs_kts,on_ground
0.0,37.5,-122.0,100.0,0.0,0.0,1
1.0,37.5,-122.0,102.0,45.0,45.0,1
2.0,37.5,-122.0,105.0,55.0,55.0,0
3.0,37.5,-122.0,110.0,65.0,65.0,0`;

const result1 = evaluateFlight(csvNoMeta, 'L1', 'test.csv');
assert(result1.result !== null, 'LessonResult returned');
assert(result1.json !== null, 'JSON output generated');
assert(result1.html !== null, 'HTML output generated');
assert(result1.metadata !== undefined, 'Metadata field exists');
assert(result1.metadata.lesson_tag === undefined, 'No lesson_tag when not in CSV');
assert(result1.metadata.arc === undefined, 'No arc when not in CSV');

// ─── Test 2: evaluateFlight with metadata ────────────────────────────
console.log('\n📋 Test 2: evaluateFlight with metadata in CSV');
const csvWithMeta = `# lesson_tag=L2 arc=1 recorder_version=5
t_sec,lat,lon,alt_msl_ft,ias_kts,gs_kts,on_ground
0.0,37.5,-122.0,100.0,0.0,0.0,1
1.0,37.5,-122.0,102.0,45.0,45.0,1
2.0,37.5,-122.0,105.0,55.0,55.0,0
3.0,37.5,-122.0,110.0,65.0,65.0,0`;

const result2 = evaluateFlight(csvWithMeta, 'L2', 'test_with_meta.csv');
assert(result2.result !== null, 'LessonResult returned');
assert(result2.metadata.lesson_tag === 'L2', `lesson_tag = 'L2' (got: ${result2.metadata.lesson_tag})`);
assert(result2.metadata.arc === 1, `arc = 1 (got: ${result2.metadata.arc})`);
assert(result2.metadata.recorder_version === 5, `recorder_version = 5 (got: ${result2.metadata.recorder_version})`);

// ─── Test 3: Real golden vector ──────────────────────────────────────
console.log('\n📋 Test 3: Golden vector with added metadata');
const goldenPath = path.join(__dirname, '../tests/golden-vectors/L1_perfect_pass_v5.csv');
if (fs.existsSync(goldenPath)) {
  const originalCsv = fs.readFileSync(goldenPath, 'utf-8');
  const csvWithMetadata = `# lesson_tag=L1 arc=1 recorder_version=5\n${originalCsv}`;
  
  const result3 = evaluateFlight(csvWithMetadata, 'L1', 'golden_with_meta.csv');
  assert(result3.result !== null, 'LessonResult returned for golden vector');
  assert(result3.metadata.lesson_tag === 'L1', 'lesson_tag extracted from golden vector');
  assert(result3.metadata.arc === 1, 'arc extracted from golden vector');
  assert(result3.metadata.recorder_version === 5, 'recorder_version extracted from golden vector');
  
  // Verify the scoring still works correctly
  assert(result3.result.overallScore !== undefined, 'overallScore computed');
  console.log(`  Scored: ${result3.result.overallScore}/5 (${result3.result.passed ? 'PASS' : 'FAIL'})`);
} else {
  console.log('⚠️  SKIP: Golden vector file not found');
}

console.log('\n✨ All integration tests passed!');
console.log('✅ evaluateFlight successfully returns metadata alongside scoring results');
