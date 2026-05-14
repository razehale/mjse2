// START ST-601 S2S Scoring Rubrics (ported from Python)

import { ARC_TOLERANCES, ArcTolerances, LESSON_ARC, gradeLabel } from './constants';

// ── Data classes ──────────────────────────────────────────────────────
export interface MetricResult {
  name: string;
  value: number;
  target: number;
  tolerance: number;
  score: number;
  grade: string;
  detail: string;
}

export interface PhaseResult {
  phase: string;
  startT: number;
  endT: number;
  metrics: MetricResult[];
  score: number;
  grade: string;
  coaching: string[];
}

export interface SafetyFlag {
  timestamp: number;
  flagType: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface LessonResult {
  flightId: string;
  lessonId: string;
  studentId: string;
  telemetryFile: string;
  analysisTimestamp: string;
  overallScore: number;
  overallGrade: string;
  passed: boolean;
  phases: PhaseResult[];
  safetyFlags: SafetyFlag[];
  coachingBullets: string[];
  externalRequirements: Record<string, any>;
  rawData: Record<string, any>;
  // START ST-802D Logic — Optional extras for lesson-specific outputs (e.g., L2 GLGL)
  extras?: Record<string, any>;
  // END ST-802D Logic
}

export function computePhaseScore(phase: PhaseResult): void {
  if (phase.metrics.length > 0) {
    const sum = phase.metrics.reduce((a, m) => a + m.score, 0);
    phase.score = Math.round((sum / phase.metrics.length) * 100) / 100;
  }
  phase.grade = gradeLabel(phase.score);
}

export function computeOverallScore(result: LessonResult): void {
  const scoredPhases = result.phases.filter(p => p.score > 0);
  if (scoredPhases.length > 0) {
    const sum = scoredPhases.reduce((a, p) => a + p.score, 0);
    result.overallScore = Math.round((sum / scoredPhases.length) * 100) / 100;
  }
  result.overallGrade = gradeLabel(result.overallScore);
}

// ── Scoring utilities ─────────────────────────────────────────────────
export function deviationScore(value: number, target: number, tolerance: number): number {
  if (tolerance <= 0) return value === target ? 5.0 : 1.0;
  const dev = Math.abs(value - target);
  const score = 5.0 - 2.0 * (dev / tolerance);
  return Math.round(Math.max(1.0, Math.min(5.0, score)) * 100) / 100;
}

export function booleanScore(value: boolean, expected: boolean = true): number {
  return value === expected ? 5.0 : 1.0;
}

export function rangeScore(value: number, lo: number, hi: number, tolerance: number): number {
  if (value >= lo && value <= hi) return 5.0;
  const nearest = value < lo ? lo : hi;
  return deviationScore(value, nearest, tolerance);
}

export function getArcTolerances(lessonId: string): ArcTolerances {
  const arc = LESSON_ARC[lessonId] ?? 1;
  return ARC_TOLERANCES[arc];
}

export function createEmptyResult(lessonId: string, flightId: string, studentId: string, telemetryFile: string): LessonResult {
  return {
    flightId,
    lessonId,
    studentId,
    telemetryFile,
    analysisTimestamp: new Date().toISOString(),
    overallScore: 0,
    overallGrade: '',
    passed: false,
    phases: [],
    safetyFlags: [],
    coachingBullets: [],
    externalRequirements: {},
    rawData: {},
  };
}

// END ST-601
