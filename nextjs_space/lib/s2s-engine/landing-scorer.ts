// START ST-963 Logic — Landing Scorer (VS-based severity scoring)
// Ported from Python scoring/landing_scorer.py
// Scores landings based on vertical speed at touchdown, heading alignment, and IAS.
// Uses weighted composite: VS 50%, heading 25%, IAS 25%

import {
  V_APPROACH, RWY_24, headingDiffAbs, gradeLabel,
  LANDING_GRADE_LABELS,
} from './constants';
import { deviationScore } from './rubrics';

// ── VS Severity Bands ────────────────────────────────────────────────
// touchdown_vs is typically negative (descending). We use abs for comparison.
const VS_GREASER = 150;    // |VS| < 150 fpm
const VS_SMOOTH = 250;     // |VS| < 250 fpm
const VS_ACCEPTABLE = 300; // |VS| < 300 fpm
const VS_FIRM = 400;       // |VS| < 400 fpm
// |VS| >= 400 = Rough

export interface LandingScore {
  touchdownVsFpm: number;
  vsSeverity: string;       // 'GREASER' | 'SMOOTH' | 'ACCEPTABLE' | 'FIRM' | 'ROUGH'
  vsSeverityLabel: string;  // Human-readable label
  vsScore: number;          // 1-5
  headingDevDeg: number;
  headingScore: number;     // 1-5
  touchdownIasKias: number;
  iasScore: number;         // 1-5
  gearDeflectM: number | null;
  gearPenalty: boolean;
  overallScore: number;     // Weighted composite
  overallGrade: string;
  detail: string;
}

/**
 * Classify touchdown VS into severity band.
 */
export function classifyVsSeverity(touchdownVs: number): { severity: string; label: string; score: number } {
  const absVs = Math.abs(touchdownVs);
  if (absVs < VS_GREASER) return { severity: 'GREASER', label: LANDING_GRADE_LABELS.GREASER, score: 5.0 };
  if (absVs < VS_SMOOTH) return { severity: 'SMOOTH', label: LANDING_GRADE_LABELS.SMOOTH, score: 4.0 };
  if (absVs < VS_ACCEPTABLE) return { severity: 'ACCEPTABLE', label: LANDING_GRADE_LABELS.ACCEPTABLE, score: 3.0 };
  if (absVs < VS_FIRM) return { severity: 'FIRM', label: LANDING_GRADE_LABELS.FIRM, score: 2.0 };
  return { severity: 'ROUGH', label: LANDING_GRADE_LABELS.ROUGH, score: 1.0 };
}

/**
 * Score a landing event from phase-detector metadata.
 *
 * @param touchdownVs  - Vertical speed at touchdown (fpm, negative = descending)
 * @param touchdownHdg - Heading at touchdown (degrees)
 * @param touchdownIas - IAS at touchdown (knots)
 * @param gearDeflectM - Gear deflection in meters (optional, from telemetry)
 * @param headingTolerance - Heading tolerance for scoring (default from arc tolerances)
 */
export function scoreLanding(
  touchdownVs: number,
  touchdownHdg: number,
  touchdownIas: number,
  gearDeflectM: number | null = null,
  headingTolerance: number = 10,
): LandingScore {
  // VS scoring
  const vsResult = classifyVsSeverity(touchdownVs);

  // Heading alignment scoring
  const hdgDev = headingDiffAbs(touchdownHdg, RWY_24.heading);
  const hdgScore = deviationScore(hdgDev, 0, headingTolerance);

  // IAS scoring
  const iasScore = deviationScore(touchdownIas, V_APPROACH, 5);

  // Gear deflection penalty (hard landing indicator)
  // gear_deflect > 0.1m typically indicates a hard landing
  const gearPenalty = gearDeflectM != null && Math.abs(gearDeflectM) > 0.1;

  // Weighted composite: VS 50%, heading 25%, IAS 25%
  let composite = vsResult.score * 0.50 + hdgScore * 0.25 + iasScore * 0.25;

  // Apply gear deflection penalty (cap at -1 from composite)
  if (gearPenalty) {
    composite = Math.max(1.0, composite - 1.0);
  }

  composite = Math.round(Math.max(1.0, Math.min(5.0, composite)) * 100) / 100;

  const detail = `Touchdown VS: ${Math.round(touchdownVs)} fpm (${vsResult.label}), ` +
    `Hdg dev: ${hdgDev.toFixed(1)}°, IAS: ${Math.round(touchdownIas)} KIAS` +
    (gearPenalty ? ' [GEAR DEFLECTION PENALTY]' : '');

  return {
    touchdownVsFpm: Math.round(touchdownVs),
    vsSeverity: vsResult.severity,
    vsSeverityLabel: vsResult.label,
    vsScore: vsResult.score,
    headingDevDeg: Math.round(hdgDev * 10) / 10,
    headingScore: hdgScore,
    touchdownIasKias: Math.round(touchdownIas * 10) / 10,
    iasScore,
    gearDeflectM: gearDeflectM != null ? Math.round(gearDeflectM * 1000) / 1000 : null,
    gearPenalty,
    overallScore: composite,
    overallGrade: gradeLabel(composite),
    detail,
  };
}

// END ST-963 Logic
