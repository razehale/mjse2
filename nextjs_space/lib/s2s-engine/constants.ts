// START ST-600 S2S Scoring Engine Constants (ported from Python)

// ── C172 V-Speeds (KIAS) ──────────────────────────────────────────────
export const VR = 55;
export const VY = 74;
export const V_DOWNWIND = 90;
export const V_BASE = 80;
export const V_APPROACH = 65;
export const V_BEST_GLIDE = 68;

// ── KHMP Airport ──────────────────────────────────────────────────────
export const KHMP_ELEVATION_MSL = 882;
export const PATTERN_ALT_AGL = 1000;
export const PATTERN_ALT_MSL = KHMP_ELEVATION_MSL + PATTERN_ALT_AGL; // 1882

export interface RunwayInfo {
  name: string;
  heading: number;
  lat: number;
  lon: number;
  elevationMsl: number;
  headingTolerance: number;
}

export const RWY_24: RunwayInfo = {
  name: '24', heading: 240, lat: 33.3898, lon: -84.3281,
  elevationMsl: KHMP_ELEVATION_MSL, headingTolerance: 20,
};

export const RWY_06: RunwayInfo = {
  name: '06', heading: 60, lat: 33.3885, lon: -84.3310,
  elevationMsl: KHMP_ELEVATION_MSL, headingTolerance: 20,
};

export const RWY06_POWERLINE_MSL = 920;

// START ST-963 Logic — Pattern heading targets (Rwy 24, left traffic)
export const PATTERN_UPWIND_HDG = 240;   // Same as runway heading
export const PATTERN_CROSSWIND_HDG = 330;
export const PATTERN_DOWNWIND_HDG = 60;
export const PATTERN_BASE_HDG = 150;
export const PATTERN_FINAL_HDG = 240;    // Same as runway heading
// END ST-963 Logic

// START ST-963 Logic — GTGL Sequence Constants
export const GTGL_THROTTLE_FULL = 0.8;        // Throttle considered "full power" for GA detection
export const GTGL_GO_AROUND_ALT_MAX = 500;     // Max AGL for valid GA initiation
export const GTGL_GA_CLIMB_MIN_SEC = 5;        // Min seconds of climb to confirm GA
export const GTGL_TNG_TIMEOUT = 30;            // Max seconds on ground for touch-and-go
export const GTGL_TNG_MIN_SPEED = 30;          // Min groundspeed (kts) to confirm T&G rotation
export const GTGL_FULL_STOP_SPEED = 5;         // GS below this = full stop
export const GTGL_FULL_STOP_IDLE_SEC = 10;     // Seconds at idle to confirm full stop landing

// Commitment Gate thresholds (ST-963: GA only scores >2 if these are met)
export const COMMITMENT_GATE_ALT_AGL = 300;    // Must be below this altitude
export const COMMITMENT_GATE_HDG_TOL = 10;     // Heading must be within ±10° of Rwy 24
export const COMMITMENT_GATE_DIST_NM = 1.5;    // Must be within 1.5 NM of threshold
export const COMMITMENT_GATE_IAS_TARGET = 65;  // IAS trending toward approach speed
// END ST-963 Logic

// ── START ST-805C — Ball-Centered Coordination Tolerances ──────────────
export const BALL_CENTERED_CLIMB_TOLERANCE_DEG = 3.0;       // ±3° slip during climb phases
export const BALL_CENTERED_SLOW_FLIGHT_TOLERANCE_DEG = 4.0;  // ±4° slip during slow flight (looser due to reduced control effectiveness)
// ── END ST-805C ────────────────────────────────────────────────────────

// ── Grading Scale ─────────────────────────────────────────────────────
export const GRADE_LABELS: Record<number, string> = {
  1: 'Rough', 2: 'Developing', 3: 'Solid', 4: 'Sharp', 5: 'Nailed it',
};

export function gradeLabel(score: number): string {
  const rounded = Math.max(1, Math.min(5, Math.round(score)));
  return GRADE_LABELS[rounded] || 'Rough';
}

// START ST-963 Logic — Landing grade labels (VS-based severity)
export const LANDING_GRADE_LABELS: Record<string, string> = {
  GREASER: 'Greaser',
  SMOOTH: 'Smooth',
  ACCEPTABLE: 'Acceptable',
  FIRM: 'Firm',
  ROUGH: 'Rough',
};
// END ST-963 Logic

// ── Arc Tolerances ────────────────────────────────────────────────────
export interface ArcTolerances {
  verticalFt: number;
  lateralFt: number;
  headingDeg: number;
  speedKias: number;
  descentFpm: number;
}

export const ARC_TOLERANCES: Record<number, ArcTolerances> = {
  1: { verticalFt: 3.0, lateralFt: 50, headingDeg: 10, speedKias: 5, descentFpm: 200 },
  2: { verticalFt: 2.0, lateralFt: 30, headingDeg: 8, speedKias: 5, descentFpm: 200 },
  3: { verticalFt: 1.5, lateralFt: 20, headingDeg: 5, speedKias: 5, descentFpm: 200 },
  4: { verticalFt: 1.5, lateralFt: 20, headingDeg: 5, speedKias: 5, descentFpm: 200 },
  5: { verticalFt: 1.5, lateralFt: 20, headingDeg: 5, speedKias: 5, descentFpm: 200 },
};

export const LESSON_ARC: Record<string, number> = {
  L1: 1, L2: 1, L3: 1, L4: 1,
  L5: 2, L6: 2, L7: 2, L8: 2,
  L9: 3, L10: 3, L11: 3,
  L12: 4, L13: 4, L14: 4,
  L15: 5, L16: 5, L17: 5,
};

// ── Geo helpers ───────────────────────────────────────────────────────
export function haversineFt(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 20_902_231; // Earth radius in feet
  const rlat1 = (lat1 * Math.PI) / 180;
  const rlat2 = (lat2 * Math.PI) / 180;
  const dlat = ((lat2 - lat1) * Math.PI) / 180;
  const dlon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dlat / 2) ** 2 + Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(dlon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// START ST-963 Logic — NM conversion helper
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  return haversineFt(lat1, lon1, lat2, lon2) / 6076.12;
}
// END ST-963 Logic

export function headingDiff(h1: number, h2: number): number {
  let d = ((h2 - h1) % 360 + 360) % 360;
  return d <= 180 ? d : d - 360;
}

// START ST-963 Logic — Additional heading helpers
export function headingDiffAbs(h1: number, h2: number): number {
  return Math.abs(headingDiff(h1, h2));
}

export function isHeadingInRange(h: number, target: number, tolerance: number): boolean {
  return headingDiffAbs(h, target) <= tolerance;
}
// END ST-963 Logic

// END ST-600
