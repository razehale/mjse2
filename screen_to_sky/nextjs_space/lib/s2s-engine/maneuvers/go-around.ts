// START ST-802D Logic — Go-Around Detection & Scoring (TS port of go_around.py)
// Updated ST-963: Added Commitment Gate + Early GA tagging + Safety Overrides

import { TelemetryDataFrame, col } from '../telemetry-parser';
import {
  VY, V_APPROACH, gradeLabel,
  COMMITMENT_GATE_ALT_AGL, COMMITMENT_GATE_HDG_TOL,
  COMMITMENT_GATE_DIST_NM, COMMITMENT_GATE_IAS_TARGET,
  RWY_24, headingDiffAbs, haversineNm,
} from '../constants';

// ─── Constants ────────────────────────────────────────────────────────
const FULL_THROTTLE = 0.95;
const APPROACH_THROTTLE_MAX = 0.5;
const MIN_DESCENT_VS = -100;
const MIN_ALT_AGL = 30;
const MANEUVER_WINDOW_SEC = 30;
const STALL_IAS = 52;
const UNSAFE_IAS = 55;
const CONTINUED_SINK_SEC = 3.0;
const SUSTAINED_CLIMB_VS = 100;
const SUSTAINED_CLIMB_DURATION = 3;
const FLAP_SNAP_SEC = 1.0;

// ─── Types ────────────────────────────────────────────────────────────
export interface GoAroundEvent {
  decisionIdx: number;
  decisionT: number;
  altAglAtDecision: number;
  powerStartIdx: number;
  windowStartIdx: number;
  windowEndIdx: number;
  approachUnstable: boolean;
  approachDetail: string;
}

export interface GoAroundScore {
  maneuver: 'go_around';
  timestampStart: string;
  altitudeAglAtDecision: number;
  decisionAppropriate: boolean;
  powerApplication: { score: number; time_to_full_throttle_sec: number | null; details: string };
  pitchControl: { score: number; time_to_arrest_sink_sec: number | null; min_ias_kts: number; max_sink_after_power_fpm: number; details: string };
  flapManagement: { score: number; initial_retraction_delay_sec: number | null; retraction_sequence: string; details: string };
  climbPerformance: { score: number; time_to_positive_climb_sec: number | null; climb_ias_kts: number; climb_vs_fpm: number; details: string };
  failureConditions: string[];
  overallScore: number;
  overallGrade: string;
  coaching: string[];
}

// START ST-963 Logic — Commitment Gate result
export interface CommitmentGateResult {
  passed: boolean;
  altBelow300: boolean;
  headingAligned: boolean;
  withinRange: boolean;
  descending: boolean;
  iasTrending65: boolean;
  detail: string;
}

/**
 * Evaluate whether a go-around was initiated from a committed position.
 * GA only scores >2 if ALL commitment conditions are met:
 * - Alt < 300 AGL
 * - Heading within ±10° of Rwy 24 (240°)
 * - Within 1.5 NM of runway threshold
 * - Descending (VS < 0)
 * - IAS trending toward 65 KIAS (within ±10)
 */
export function evaluateCommitmentGate(df: TelemetryDataFrame, event: GoAroundEvent): CommitmentGateResult {
  const altAgl = col(df, 'alt_agl');
  const hdg = col(df, 'hdg');
  const vs = col(df, 'vs');
  const ias = col(df, 'ias');
  const lat = col(df, 'lat');
  const lon = col(df, 'lon');

  const idx = event.decisionIdx;
  const alt = altAgl[idx] ?? 999;
  const h = hdg[idx] ?? 0;
  const vertSpeed = vs[idx] ?? 0;
  const airspeed = ias[idx] ?? 0;
  const pLat = lat[idx] ?? 0;
  const pLon = lon[idx] ?? 0;

  const altBelow300 = alt < COMMITMENT_GATE_ALT_AGL;
  const headingAligned = headingDiffAbs(h, RWY_24.heading) <= COMMITMENT_GATE_HDG_TOL;
  const distNm = haversineNm(pLat, pLon, RWY_24.lat, RWY_24.lon);
  const withinRange = distNm <= COMMITMENT_GATE_DIST_NM;
  const descending = vertSpeed < 0;
  const iasTrending65 = Math.abs(airspeed - COMMITMENT_GATE_IAS_TARGET) <= 10;

  const passed = altBelow300 && headingAligned && withinRange && descending && iasTrending65;

  const reasons: string[] = [];
  if (!altBelow300) reasons.push(`Alt ${Math.round(alt)} AGL (need <${COMMITMENT_GATE_ALT_AGL})`);
  if (!headingAligned) reasons.push(`Hdg ${Math.round(h)}° (need ±${COMMITMENT_GATE_HDG_TOL}° of 240°)`);
  if (!withinRange) reasons.push(`${distNm.toFixed(1)} NM from threshold (need <${COMMITMENT_GATE_DIST_NM})`);
  if (!descending) reasons.push(`VS ${Math.round(vertSpeed)} fpm (need descending)`);
  if (!iasTrending65) reasons.push(`IAS ${Math.round(airspeed)} KIAS (need ≈${COMMITMENT_GATE_IAS_TARGET})`);

  return {
    passed,
    altBelow300,
    headingAligned,
    withinRange,
    descending,
    iasTrending65,
    detail: passed ? 'Commitment gate passed — proper GA position' : `Commitment gate FAILED: ${reasons.join('; ')}`,
  };
}

/**
 * Detect if this is an "early" go-around (initiated too high/far from runway).
 * An EARLY_GO_AROUND is one where alt > 300 AGL or distance > 1.5 NM.
 * These are detected but force score ≤ 2 and tagged "EARLY_GO_AROUND".
 */
export function isEarlyGoAround(df: TelemetryDataFrame, event: GoAroundEvent): boolean {
  const altAgl = col(df, 'alt_agl');
  const lat = col(df, 'lat');
  const lon = col(df, 'lon');

  const alt = altAgl[event.decisionIdx] ?? 999;
  const pLat = lat[event.decisionIdx] ?? 0;
  const pLon = lon[event.decisionIdx] ?? 0;
  const distNm = haversineNm(pLat, pLon, RWY_24.lat, RWY_24.lon);

  return alt > COMMITMENT_GATE_ALT_AGL || distNm > COMMITMENT_GATE_DIST_NM;
}
// END ST-963 Logic

// ─── Helpers ──────────────────────────────────────────────────────────
function min(arr: number[]): number { let m = Infinity; for (const v of arr) if (v < m) m = v; return m === Infinity ? 0 : m; }
function mean(arr: number[]): number { if (!arr.length) return 0; let s = 0; for (const v of arr) s += v; return s / arr.length; }
function stdDev(arr: number[]): number { if (arr.length < 2) return 0; const m = mean(arr); let v = 0; for (const x of arr) v += (x - m) ** 2; return Math.sqrt(v / arr.length); }

// ─── Detection ────────────────────────────────────────────────────────
export function detectGoArounds(df: TelemetryDataFrame): GoAroundEvent[] {
  const events: GoAroundEvent[] = [];
  const n = df.length;
  if (n < 10) return events;
  const t = col(df, 't');
  const throttle = col(df, 'throttle');
  const vs = col(df, 'vs');
  const altAgl = col(df, 'alt_agl');
  const onGround = col(df, 'on_ground');

  const used = new Set<number>();
  let i = 0;
  while (i < n - 5) {
    if (onGround[i] !== 0 || used.has(i)) { i++; continue; }
    if (vs[i] < MIN_DESCENT_VS && throttle[i] < APPROACH_THROTTLE_MAX) {
      let rampIdx: number | null = null;
      for (let j = i + 1; j < Math.min(i + 30, n); j++) {
        if (onGround[j] !== 0) break;
        if (throttle[j] >= 0.85) { rampIdx = j; break; }
      }
      if (rampIdx != null && onGround[rampIdx] === 0) {
        let decisionIdx = i;
        for (let k = rampIdx - 1; k >= i; k--) {
          if (vs[k] < MIN_DESCENT_VS) { decisionIdx = k; break; }
        }
        let windowEnd = Math.min(decisionIdx + MANEUVER_WINDOW_SEC * 2, n - 1);
        const decisionTime = t[decisionIdx];
        for (let wi = decisionIdx; wi < n; wi++) {
          if (t[wi] - decisionTime > MANEUVER_WINDOW_SEC) { windowEnd = wi; break; }
        }
        let touchdownInWindow = false;
        for (let k = decisionIdx; k <= windowEnd; k++) if (onGround[k] !== 0) { touchdownInWindow = true; break; }
        if (touchdownInWindow) { i = rampIdx + 1; continue; }
        let climbFound = false;
        for (let k = rampIdx; k <= windowEnd; k++) if (vs[k] > 0) { climbFound = true; break; }
        if (!climbFound) { i = rampIdx + 1; continue; }
        const stab = checkApproachStability(df, decisionIdx);
        events.push({
          decisionIdx, decisionT: t[decisionIdx], altAglAtDecision: altAgl[decisionIdx],
          powerStartIdx: rampIdx, windowStartIdx: decisionIdx, windowEndIdx: windowEnd,
          approachUnstable: stab.unstable, approachDetail: stab.detail,
        });
        for (let u = decisionIdx; u <= windowEnd; u++) used.add(u);
        i = windowEnd + 1;
        continue;
      }
    }
    i++;
  }
  return events;
}

function checkApproachStability(df: TelemetryDataFrame, decisionIdx: number): { unstable: boolean; detail: string } {
  const t = col(df, 't');
  const iasArr = col(df, 'ias');
  const vsArr = col(df, 'vs');
  const decisionTime = t[decisionIdx];
  let lookbackStart = decisionIdx;
  for (let k = decisionIdx - 1; k >= 0; k--) {
    if (decisionTime - t[k] > 10) { lookbackStart = k; break; }
    lookbackStart = k;
  }
  const segIas: number[] = [];
  const segVs: number[] = [];
  for (let k = lookbackStart; k <= decisionIdx; k++) { segIas.push(iasArr[k]); segVs.push(vsArr[k]); }
  const reasons: string[] = [];
  if (segIas.length > 2) {
    const m = mean(segIas);
    if (Math.abs(m - V_APPROACH) > 10) reasons.push(`IAS was ${m.toFixed(0)} KIAS (target ${V_APPROACH})`);
  }
  if (segVs.length > 2) {
    const sd = stdDev(segVs);
    if (sd > 300) reasons.push(`VS unstable (σ=${sd.toFixed(0)} FPM)`);
  }
  return { unstable: reasons.length > 0, detail: reasons.length ? reasons.join('; ') : 'Approach appeared stable' };
}

// ─── Scoring ──────────────────────────────────────────────────────────
export function scoreGoAround(df: TelemetryDataFrame, event: GoAroundEvent): GoAroundScore {
  const t = col(df, 't');
  const throttle = col(df, 'throttle');
  const vsArr = col(df, 'vs');
  const iasArr = col(df, 'ias');
  const flapArr = col(df, 'flap_ratio');
  const onGround = col(df, 'on_ground');

  const ws = event.windowStartIdx;
  const we = event.windowEndIdx;
  const decisionT = event.decisionT;

  const findFullThrottleTime = (): number | null => {
    for (let i = ws; i <= we; i++) if (t[i] >= decisionT && throttle[i] >= FULL_THROTTLE) return t[i];
    return null;
  };
  const findPowerApplyTime = (): number | null => {
    for (let i = ws; i <= we; i++) if (t[i] >= decisionT && throttle[i] > APPROACH_THROTTLE_MAX) return t[i];
    return null;
  };
  const findSinkArrestTime = (refT: number): number | null => {
    for (let i = ws; i <= we; i++) if (t[i] >= refT && vsArr[i] >= 0) return t[i];
    return null;
  };

  // Power Application
  const ftT = findFullThrottleTime();
  const dt = ftT != null ? Math.round((ftT - decisionT) * 10) / 10 : null;
  let powerScore = 1, powerDetail = '';
  if (dt == null) { powerScore = 1; powerDetail = 'Never reached full throttle during go-around'; }
  else if (dt <= 1.5) { powerScore = 5; powerDetail = 'Immediate, decisive power application'; }
  else if (dt <= 2.5) { powerScore = 4; powerDetail = 'Good power application, slight hesitation'; }
  else if (dt <= 4.0) { powerScore = 3; powerDetail = 'Adequate power application, noticeable delay'; }
  else if (dt <= 6.0) { powerScore = 2; powerDetail = 'Hesitant, slow power application'; }
  else { powerScore = 1; powerDetail = `Severely delayed power application (${dt}s)`; }

  // Pitch Control
  const refT = ftT != null ? ftT : decisionT;
  const arrestT = findSinkArrestTime(refT);
  const timeToArrest = arrestT != null ? Math.round((arrestT - refT) * 10) / 10 : null;
  let arrestScore = 1;
  if (timeToArrest == null) arrestScore = 1;
  else if (timeToArrest <= 2.0) arrestScore = 5;
  else if (timeToArrest <= 3.0) arrestScore = 4;
  else if (timeToArrest <= 5.0) arrestScore = 3;
  else if (timeToArrest <= 8.0) arrestScore = 2;
  else arrestScore = 1;

  const maneuverIas: number[] = [];
  for (let i = ws; i <= we; i++) if (t[i] >= decisionT) maneuverIas.push(iasArr[i]);
  const minIas = maneuverIas.length ? min(maneuverIas) : 0;
  let iasScore = 1;
  if (minIas >= 60) iasScore = 5;
  else if (minIas >= 57) iasScore = 4;
  else if (minIas >= 55) iasScore = 3;
  else if (minIas >= 52) iasScore = 2;
  else iasScore = 1;

  const sinkAfterPower: number[] = [];
  if (ftT != null) { for (let i = ws; i <= we; i++) if (t[i] >= ftT) sinkAfterPower.push(vsArr[i]); }
  else { for (let i = ws; i <= we; i++) if (t[i] >= decisionT) sinkAfterPower.push(vsArr[i]); }
  const maxSink = sinkAfterPower.length ? min(sinkAfterPower) : 0;

  const pitchScore = Math.round(((arrestScore + iasScore) / 2.0) * 10) / 10;
  const pitchDetail = `${timeToArrest != null ? `Sink arrested in ${timeToArrest}s` : 'Sink not arrested'}, Min IAS ${minIas.toFixed(0)} KIAS`;

  // Flap Management
  const paT = findPowerApplyTime();
  let flapScore = 3, flapDelay: number | null = null, flapSeq = 'unknown', flapDetail = 'Flap data not available';
  if (paT != null) {
    let paIdx = ws;
    for (let i = ws; i <= we; i++) if (t[i] >= paT) { paIdx = i; break; }
    const initialFlap = flapArr[paIdx] ?? 0;
    if (initialFlap < 0.1) {
      flapScore = 3; flapDelay = 0; flapSeq = 'already_retracted'; flapDetail = 'Flaps were already retracted at go-around initiation';
    } else {
      let firstChangeT: number | null = null;
      for (let i = paIdx + 1; i <= we; i++) {
        if (Math.abs(flapArr[i] - initialFlap) > 0.05) { firstChangeT = t[i]; break; }
      }
      flapDelay = firstChangeT != null ? Math.round((firstChangeT - paT) * 10) / 10 : null;
      let isSnap = false;
      if (firstChangeT != null) {
        const snapEnd = firstChangeT + FLAP_SNAP_SEC;
        for (let i = paIdx; i <= we; i++) {
          if (t[i] >= firstChangeT && t[i] <= snapEnd) {
            if ((flapArr[i] ?? 0) <= 0.05 && initialFlap >= 0.9) { isSnap = true; break; }
          }
        }
      }
      if (isSnap) flapSeq = 'instant_snap';
      else if (firstChangeT != null) {
        let changes = 0; let prev = initialFlap;
        for (let i = paIdx; i <= we; i++) {
          if (Math.abs(flapArr[i] - prev) > 0.1) { changes++; prev = flapArr[i]; }
        }
        flapSeq = changes >= 2 ? 'gradual' : 'single_step';
      } else { flapSeq = 'no_retraction'; }

      if (isSnap) { flapScore = 1; flapDetail = 'UNSAFE: Instant flap retraction (1.0→0.0) — risk of stall/sink'; }
      else if (flapDelay == null) { flapScore = 1; flapDetail = 'No flap retraction detected during go-around'; }
      else if (flapDelay >= 1.0 && flapDelay <= 3.0 && flapSeq === 'gradual') { flapScore = 5; flapDetail = `Proper gradual retraction starting at ${flapDelay}s`; }
      else if (flapDelay >= 0.5 && flapDelay <= 5.0) { flapScore = 4; flapDetail = `Timely retraction at ${flapDelay}s, ${flapSeq} sequence`; }
      else if (flapDelay >= 0.5 && flapDelay <= 8.0) { flapScore = 3; flapDetail = `Retraction at ${flapDelay}s — adequate but tardy`; }
      else if (flapDelay >= 0.5 && flapDelay <= 12.0) { flapScore = 2; flapDetail = `Very delayed retraction at ${flapDelay}s`; }
      else { flapScore = 1; flapDetail = `Retraction delay ${flapDelay}s — unacceptable`; }
    }
  }

  // Climb Performance
  let climbStartT: number | null = null;
  if (paT != null) {
    const lastIdx = we;
    for (let i = ws; i <= we; i++) {
      if (t[i] < paT) continue;
      if (vsArr[i] >= SUSTAINED_CLIMB_VS) {
        let sustained = true;
        for (let j = i; j <= Math.min(i + SUSTAINED_CLIMB_DURATION, lastIdx); j++) {
          if (vsArr[j] < SUSTAINED_CLIMB_VS) { sustained = false; break; }
        }
        if (sustained) { climbStartT = t[i]; break; }
      }
    }
  }
  const timeToClimb = climbStartT != null && paT != null ? Math.round((climbStartT - paT) * 10) / 10 : null;
  let climbIas = 0, climbVs = 0;
  if (climbStartT != null) {
    const climbIasArr: number[] = [];
    const climbVsArr: number[] = [];
    for (let i = ws; i <= we; i++) if (t[i] >= climbStartT) { climbIasArr.push(iasArr[i]); climbVsArr.push(vsArr[i]); }
    climbIas = mean(climbIasArr);
    climbVs = mean(climbVsArr);
  } else if (we - ws >= 5) {
    const tailIas: number[] = [], tailVs: number[] = [];
    for (let i = Math.max(ws, we - 5); i <= we; i++) { tailIas.push(iasArr[i]); tailVs.push(vsArr[i]); }
    climbIas = mean(tailIas); climbVs = mean(tailVs);
  }
  let timeScore = 1;
  if (timeToClimb == null) timeScore = 1;
  else if (timeToClimb <= 8.0) timeScore = 5;
  else if (timeToClimb <= 12.0) timeScore = 4;
  else if (timeToClimb <= 15.0) timeScore = 3;
  else if (timeToClimb <= 20.0) timeScore = 2;
  else timeScore = 1;
  const iasDev = Math.abs(climbIas - VY);
  let climbIasScore = 1;
  if (iasDev <= 3) climbIasScore = 5;
  else if (iasDev <= 5) climbIasScore = 4;
  else if (climbIas >= 65 && climbIas <= 83) climbIasScore = 3;
  else if (climbIas >= 60 && climbIas <= 90) climbIasScore = 2;
  else climbIasScore = 1;
  let vsScore = 1;
  if (climbVs >= 500) vsScore = 5;
  else if (climbVs >= 400) vsScore = 4;
  else if (climbVs >= 300) vsScore = 3;
  else if (climbVs >= 150) vsScore = 2;
  else vsScore = 1;
  const climbScore = Math.round((timeScore * 0.3 + climbIasScore * 0.4 + vsScore * 0.3) * 10) / 10;
  const climbDetail = `${timeToClimb != null ? `Climb established in ${timeToClimb}s` : 'Climb not established within window'}, at ${climbIas.toFixed(0)} KIAS / ${climbVs.toFixed(0)} FPM`;

  // Failures
  const failures: string[] = [];
  const airborneIas: number[] = [];
  for (let i = ws; i <= we; i++) if (onGround[i] === 0) airborneIas.push(iasArr[i]);
  if (airborneIas.length && min(airborneIas) < STALL_IAS) {
    failures.push(`STALL: IAS dropped to ${min(airborneIas).toFixed(0)} KIAS (below ${STALL_IAS}) during go-around`);
  }
  if (ftT != null) {
    let lastVs: number | null = null;
    for (let i = ws; i <= we; i++) if (t[i] >= ftT && t[i] <= ftT + CONTINUED_SINK_SEC) lastVs = vsArr[i];
    if (lastVs != null && lastVs < 0) {
      failures.push(`CONTINUED_SINK: VS still negative ${CONTINUED_SINK_SEC.toFixed(0)}s after full throttle (VS=${lastVs.toFixed(0)} FPM)`);
    }
  }
  let touched = false;
  for (let i = ws; i <= we; i++) if (onGround[i] !== 0) { touched = true; break; }
  if (touched) failures.push('TOUCHDOWN: Aircraft touched down during go-around — not a valid go-around');
  if (event.altAglAtDecision < MIN_ALT_AGL) {
    failures.push(`LOW_ALTITUDE: Go-around initiated at ${event.altAglAtDecision.toFixed(0)} ft AGL (minimum ${MIN_ALT_AGL} ft)`);
  }
  if (airborneIas.length && min(airborneIas) < UNSAFE_IAS && min(airborneIas) >= STALL_IAS) {
    failures.push(`AIRSPEED_DECAY: IAS dropped to ${min(airborneIas).toFixed(0)} KIAS (below safe floor of ${UNSAFE_IAS})`);
  }

  // Overall
  let overallScore: number;
  let overallGrade: string;
  if (failures.length) {
    overallScore = 1.0;
    overallGrade = 'Rough';
  } else {
    overallScore = Math.round(((powerScore + pitchScore + flapScore + climbScore) / 4.0) * 10) / 10;
    overallGrade = gradeLabel(overallScore);
  }

  const result: GoAroundScore = {
    maneuver: 'go_around',
    timestampStart: decisionT.toFixed(1),
    altitudeAglAtDecision: event.altAglAtDecision,
    decisionAppropriate: event.approachUnstable,
    powerApplication: { score: powerScore, time_to_full_throttle_sec: dt, details: powerDetail },
    pitchControl: { score: pitchScore, time_to_arrest_sink_sec: timeToArrest, min_ias_kts: Math.round(minIas * 10) / 10, max_sink_after_power_fpm: Math.round(maxSink), details: pitchDetail },
    flapManagement: { score: flapScore, initial_retraction_delay_sec: flapDelay, retraction_sequence: flapSeq, details: flapDetail },
    climbPerformance: { score: climbScore, time_to_positive_climb_sec: timeToClimb, climb_ias_kts: Math.round(climbIas * 10) / 10, climb_vs_fpm: Math.round(climbVs), details: climbDetail },
    failureConditions: failures,
    overallScore, overallGrade,
    coaching: [],
  };
  result.coaching = generateCoaching(result, event);
  return result;
}

function generateCoaching(r: GoAroundScore, ev: GoAroundEvent): string[] {
  const out: string[] = [];
  if (ev.approachUnstable) out.push(`Good decision to go around — approach was unstable (${ev.approachDetail}).`);
  else out.push('Go-around executed from a stable approach — ensure this was intentional/instructed.');
  const alt = ev.altAglAtDecision;
  if (alt >= 200) out.push(`Decision made at ${alt.toFixed(0)} ft AGL — good altitude margin for safe execution.`);
  else if (alt >= 100) out.push(`Decision at ${alt.toFixed(0)} ft AGL — adequate, but earlier is better.`);
  else if (alt >= MIN_ALT_AGL) out.push(`Decision at ${alt.toFixed(0)} ft AGL — very late! Aim for earlier go-around decisions.`);

  if (r.powerApplication.score >= 4) out.push('Power application was prompt and decisive.');
  else if (r.powerApplication.score >= 3) out.push(`Power application adequate but took ${r.powerApplication.time_to_full_throttle_sec}s — aim for <2 seconds.`);
  else out.push('Work on applying full power immediately when deciding to go around.');

  if (r.pitchControl.score >= 4) out.push('Excellent pitch control — sink arrested quickly.');
  else if (r.pitchControl.time_to_arrest_sink_sec != null) out.push(`Work on arresting sink more quickly — took ${r.pitchControl.time_to_arrest_sink_sec} seconds.`);

  if (r.flapManagement.retraction_sequence === 'instant_snap') out.push('⚠️ NEVER retract flaps instantly during a go-around — this causes a sudden loss of lift. Retract in stages: full → approach → up.');
  else if (r.flapManagement.score >= 4) out.push('Good flap management — proper retraction sequence.');
  else if (r.flapManagement.score < 3) out.push('Review flap retraction procedure: full → approach flaps → gradual retraction as speed builds.');

  if (r.climbPerformance.score >= 4) out.push(`Excellent climb-out technique at ${r.climbPerformance.climb_ias_kts.toFixed(0)} KIAS.`);
  else if (r.climbPerformance.score >= 3) out.push(`Climb established — aim for Vy (${VY} KIAS) for best rate of climb.`);
  else out.push(`Work on establishing a stable climb at Vy (${VY} KIAS) promptly after go-around.`);

  for (const f of r.failureConditions) out.push(`🚨 SAFETY: ${f}`);
  return out;
}

// END ST-802D Logic
