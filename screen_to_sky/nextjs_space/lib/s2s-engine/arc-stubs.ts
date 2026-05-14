// START ST-605 Arc 2–5 Stubs (ported from Python)

import { TelemetryDataFrame } from './telemetry-parser';
import { ARC_TOLERANCES, LESSON_ARC, gradeLabel } from './constants';
import { LessonResult, createEmptyResult } from './rubrics';

const LESSON_INFO: Record<string, { name: string; arc: number; description: string }> = {
  L5: { name: 'Pattern Master I', arc: 2, description: 'Refined pattern work with tighter tolerances' },
  L6: { name: 'Pattern Master II', arc: 2, description: 'Wind correction and crosswind patterns' },
  L7: { name: 'Pattern Master III', arc: 2, description: 'Short-field and soft-field operations' },
  L8: { name: 'Check 251', arc: 2, description: 'Arc 2 check flight' },
  L9: { name: 'Departure I', arc: 3, description: 'Departure procedures and navigation' },
  L10: { name: 'Departure II', arc: 3, description: 'VOR tracking and pilotage' },
  L11: { name: 'Check 252', arc: 3, description: 'Arc 3 check flight' },
  L12: { name: 'Emergency I', arc: 4, description: 'Engine-out procedures' },
  L13: { name: 'Emergency II', arc: 4, description: 'System failures and diversion' },
  L14: { name: 'Check 253', arc: 4, description: 'Arc 4 check flight with emergencies' },
  L15: { name: 'XC Planning', arc: 5, description: 'Cross-country planning and execution' },
  L16: { name: 'XC Solo I', arc: 5, description: 'Solo cross-country flight' },
  L17: { name: 'XC Solo II', arc: 5, description: 'Final solo cross-country' },
};

export function gradeStub(df: TelemetryDataFrame, lessonId: string, studentId = 'unknown', flightId = '', telemetryFile = ''): LessonResult {
  const info = LESSON_INFO[lessonId] ?? { name: `Unknown Lesson ${lessonId}`, arc: LESSON_ARC[lessonId] ?? 1, description: 'No description available' };
  const arc = info.arc;
  const tol = ARC_TOLERANCES[arc];
  const result = createEmptyResult(lessonId, flightId || new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15), studentId, telemetryFile);
  result.overallScore = 0;
  result.overallGrade = 'NOT_IMPLEMENTED';
  result.passed = false;
  result.rawData = {
    status: 'LESSON_NOT_IMPLEMENTED',
    lesson_name: info.name,
    lesson_description: info.description,
    arc,
    arc_tolerances: { vertical_ft: tol.verticalFt, lateral_ft: tol.lateralFt, heading_deg: tol.headingDeg, speed_kias: tol.speedKias, descent_fpm: tol.descentFpm },
    message: `Grading logic for ${lessonId} (${info.name}) is not yet implemented. This lesson belongs to Arc ${arc} with tolerances: ±${tol.verticalFt} ft vertical, ±${tol.lateralFt} ft lateral, ±${tol.headingDeg}° heading.`,
  };
  result.coachingBullets = [
    `⏳ ${lessonId} (${info.name}) grading is not yet implemented.`,
    `Arc ${arc} difficulty multiplier: ±${tol.verticalFt} ft / ±${tol.lateralFt} ft / ±${tol.headingDeg}°`,
  ];
  return result;
}

// END ST-605
