// START ST-608 S2S Scoring Engine — Main entry point
// TypeScript port of the Python s2s_scoring_engine module.
// Usage:
//   import { evaluateFlight } from '@/lib/s2s-engine';
//   const result = evaluateFlight(csvText, 'L2', 'tristan', { machadoQuizPct: 85 });

import { loadTelemetry, TelemetryDataFrame } from './telemetry-parser';
import { LessonResult } from './rubrics';
import { gradeL1, gradeL2, gradeL3, gradeL4 } from './arc1-grader';
import { gradeStub } from './arc-stubs';
import { toDict } from './json-formatter';
import { toHtml } from './html-generator';

export interface EvaluateFlightOptions {
  studentId?: string;
  flightId?: string;
  machadoQuizPct?: number;
  checklistTime?: number;
  resampleHz?: number;
}

export interface EvaluateFlightResult {
  result: LessonResult;
  json: Record<string, any>;
  html: string;
}

/**
 * End-to-end: parse CSV → grade → return result + JSON + HTML.
 */
export function evaluateFlight(
  csvText: string,
  lessonId: string,
  telemetryFile: string = 'upload.csv',
  opts: EvaluateFlightOptions = {},
): EvaluateFlightResult {
  const { studentId = 'unknown', flightId = '', machadoQuizPct, checklistTime, resampleHz = 1.0 } = opts;
  const df = loadTelemetry(csvText, resampleHz);
  const fId = flightId || (telemetryFile.replace(/\.csv$/i, ''));

  const lessonUpper = lessonId.toUpperCase();
  let result: LessonResult;

  switch (lessonUpper) {
    case 'L1':
      result = gradeL1(df, studentId, fId, telemetryFile);
      break;
    case 'L2':
      result = gradeL2(df, studentId, fId, telemetryFile, machadoQuizPct);
      break;
    case 'L3':
      result = gradeL3(df, studentId, fId, telemetryFile, checklistTime);
      break;
    case 'L4':
      result = gradeL4(df, studentId, fId, telemetryFile, machadoQuizPct);
      break;
    default:
      result = gradeStub(df, lessonUpper, studentId, fId, telemetryFile);
      break;
  }

  return {
    result,
    json: toDict(result),
    html: toHtml(result),
  };
}

// Re-exports for convenience
export type { LessonResult } from './rubrics';
export { toDict } from './json-formatter';
export { toHtml } from './html-generator';
export { loadTelemetry, col } from './telemetry-parser';
export type { TelemetryDataFrame } from './telemetry-parser';

// END ST-608
