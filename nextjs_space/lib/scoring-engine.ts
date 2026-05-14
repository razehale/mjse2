// ST-510: Scoring Engine
// 1-5 scale ONLY. No percentages.

import { TelemetryRow, C172_CONSTANTS, KHMP_CONSTANTS, FlightSegment } from '@/types/telemetry';
import { ScoreBreakdown } from '@/types/lessons';

export interface ScoreResult {
  overallScore: number; // 1-5
  breakdown: ScoreBreakdown;
  coachingNotes: string[];
}

export function scoreFlightSession(
  rows: TelemetryRow[],
  segments: FlightSegment[],
  lessonNum: number
): ScoreResult {
  if ((rows?.length ?? 0) < 10) {
    return { overallScore: 1, breakdown: {}, coachingNotes: ['Insufficient telemetry data for scoring.'] };
  }

  const breakdown: ScoreBreakdown = {};
  const notes: string[] = [];

  // Score rotation speed
  const takeoffSegments = (segments ?? []).filter((s: FlightSegment) => s?.type === 'TAKEOFF_ROLL' || s?.type === 'LIFTOFF');
  if ((takeoffSegments?.length ?? 0) > 0) {
    const liftoffSeg = takeoffSegments.find((s: FlightSegment) => s?.type === 'LIFTOFF');
    if (liftoffSeg) {
      const liftoffRow = rows?.[liftoffSeg?.startIndex ?? 0];
      const actualVr = liftoffRow?.ias_kts ?? 0;
      const vrScore = scoreDeviation(actualVr, C172_CONSTANTS.Vr, 5);
      breakdown.rotationSpeed = { score: vrScore, actual: Math.round(actualVr), target: C172_CONSTANTS.Vr };
      if (vrScore <= 2) notes.push(`Rotation speed was ${Math.round(actualVr)} kts, target is ${C172_CONSTANTS.Vr} kts.`);
    }
  }

  // Score climb speed
  const climbSegments = (segments ?? []).filter((s: FlightSegment) => s?.type === 'CLIMB');
  if ((climbSegments?.length ?? 0) > 0) {
    let totalClimbIas = 0, climbCount = 0;
    for (const seg of climbSegments) {
      totalClimbIas += seg?.metrics?.avgIas ?? 0;
      climbCount++;
    }
    const avgClimbIas = climbCount > 0 ? totalClimbIas / climbCount : 0;
    const vyScore = scoreDeviation(avgClimbIas, C172_CONSTANTS.Vy, 10);
    breakdown.climbSpeed = { score: vyScore, actual: Math.round(avgClimbIas), target: C172_CONSTANTS.Vy };
    if (vyScore <= 2) notes.push(`Average climb speed was ${Math.round(avgClimbIas)} kts, target is ${C172_CONSTANTS.Vy} kts.`);
  }

  // Score pattern altitude
  const patternSegments = (segments ?? []).filter((s: FlightSegment) => s?.type === 'DOWNWIND');
  if ((patternSegments?.length ?? 0) > 0) {
    let totalAlt = 0, altCount = 0;
    for (const seg of patternSegments) {
      totalAlt += seg?.metrics?.avgAltAgl ?? 0;
      altCount++;
    }
    const avgPatternAlt = altCount > 0 ? totalAlt / altCount : 0;
    const altScore = scoreDeviation(avgPatternAlt, KHMP_CONSTANTS.patternAgl, 100);
    breakdown.patternAltitude = { score: altScore, actual: Math.round(avgPatternAlt), target: KHMP_CONSTANTS.patternAgl };
    if (altScore <= 2) notes.push(`Pattern altitude averaged ${Math.round(avgPatternAlt)} ft AGL, target is ${KHMP_CONSTANTS.patternAgl} ft.`);
  }

  // Score approach speed
  const approachSegments = (segments ?? []).filter((s: FlightSegment) => s?.type === 'APPROACH');
  if ((approachSegments?.length ?? 0) > 0) {
    let totalApproachIas = 0, apprCount = 0;
    for (const seg of approachSegments) {
      totalApproachIas += seg?.metrics?.avgIas ?? 0;
      apprCount++;
    }
    const avgApproach = apprCount > 0 ? totalApproachIas / apprCount : 0;
    const apprScore = scoreDeviation(avgApproach, C172_CONSTANTS.Vapproach, 8);
    breakdown.approachSpeed = { score: apprScore, actual: Math.round(avgApproach), target: C172_CONSTANTS.Vapproach };
    if (apprScore <= 2) notes.push(`Approach speed was ${Math.round(avgApproach)} kts, target is ${C172_CONSTANTS.Vapproach} kts.`);
  }

  // Score coordination (slip angle)
  const airborneRows = (rows ?? []).filter((r: TelemetryRow) => (r?.on_ground ?? 0) < 0.5);
  if ((airborneRows?.length ?? 0) > 0) {
    let totalSlip = 0;
    for (const r of airborneRows) {
      totalSlip += Math.abs(r?.slip_deg ?? 0);
    }
    const avgSlip = totalSlip / (airborneRows?.length ?? 1);
    const coordScore = Math.max(1, Math.min(5, Math.round(5 - avgSlip)));
    breakdown.coordination = { score: coordScore, value: Math.round(avgSlip * 10) / 10 };
    if (coordScore <= 2) notes.push(`Average slip angle was ${avgSlip?.toFixed?.(1) ?? '0'}°, work on rudder coordination.`);
  }

  // Compute overall score (average of available scores)
  const scores = Object.values(breakdown ?? {}).map((v: any) => v?.score ?? 3).filter((s: number) => s > 0);
  const overallScore = (scores?.length ?? 0) > 0
    ? Math.max(1, Math.min(5, Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length)))
    : 3;

  if ((notes?.length ?? 0) === 0) {
    notes.push('Good flight! Continue practicing to improve consistency.');
  }

  return { overallScore, breakdown, coachingNotes: notes };
}

function scoreDeviation(actual: number, target: number, tolerance: number): number {
  const deviation = Math.abs((actual ?? 0) - (target ?? 0));
  if (deviation <= tolerance * 0.2) return 5;
  if (deviation <= tolerance * 0.5) return 4;
  if (deviation <= tolerance) return 3;
  if (deviation <= tolerance * 2) return 2;
  return 1;
}
