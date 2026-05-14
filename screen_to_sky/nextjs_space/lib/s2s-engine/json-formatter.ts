// START ST-606 JSON Formatter (ported from Python)

import { LessonResult } from './rubrics';

export function toDict(result: LessonResult): Record<string, any> {
  return {
    flight_id: result.flightId,
    lesson_id: result.lessonId,
    student_id: result.studentId,
    telemetry_file: result.telemetryFile,
    analysis_timestamp: result.analysisTimestamp,
    overall_score: result.overallScore,
    overall_grade: result.overallGrade,
    pass: result.passed,
    phases: result.phases.map(p => ({
      phase: p.phase,
      start_time: p.startT,
      end_time: p.endT,
      metrics: Object.fromEntries(p.metrics.map(m => [
        m.name,
        { value: m.value, target: m.target, tolerance: m.tolerance, score: m.score, grade: m.grade, detail: m.detail },
      ])),
      score: p.score,
      grade: p.grade,
      coaching: p.coaching,
    })),
    safety_flags: result.safetyFlags.map(sf => ({
      timestamp: sf.timestamp,
      type: sf.flagType,
      severity: sf.severity,
      description: sf.description,
    })),
    coaching_bullets: result.coachingBullets,
    external_requirements: result.externalRequirements,
    raw_data: result.rawData,
    // START ST-802D Logic — Lesson-specific extras (e.g., L2 GLGL)
    ...(result.extras ? { extras: result.extras } : {}),
    // END ST-802D Logic
  };
}

export function toJson(result: LessonResult): string {
  return JSON.stringify(toDict(result), null, 2);
}

// END ST-606
