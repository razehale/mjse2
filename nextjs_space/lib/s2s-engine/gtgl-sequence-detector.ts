// START ST-963 Logic — GTGL Sequence Detector
// Ported from Python scoring/gtgl_sequence_detector.py
// 4-state machine: GA1 → TNG → GA2 → LAND
// Validates the required Go-Around, Touch-and-Go, Go-Around, Landing sequence.

import { TelemetryDataFrame, col } from './telemetry-parser';
import { FlightPhase } from './phase-detector';
import {
  GTGL_THROTTLE_FULL, GTGL_GO_AROUND_ALT_MAX,
  GTGL_GA_CLIMB_MIN_SEC, GTGL_TNG_TIMEOUT, GTGL_TNG_MIN_SPEED,
  GTGL_FULL_STOP_SPEED, GTGL_FULL_STOP_IDLE_SEC,
  gradeLabel,
} from './constants';
import { GoAroundEvent, GoAroundScore } from './maneuvers/go-around';
import { LandingScore } from './landing-scorer';

// ── Types ───────────────────────────────────────────────────────────────

export type GTGLState = 'AWAITING_GA1' | 'AWAITING_TNG' | 'AWAITING_GA2' | 'AWAITING_LAND' | 'COMPLETE' | 'FAILED';

export interface GTGLEvent {
  type: 'go_around' | 'touch_and_go' | 'landing';
  label: string;         // GA1, TNG, GA2, LAND
  detected: boolean;
  timestampT: number | null;
  score: number;
  grade: string;
  // GA-specific
  altAglAtDecision?: number;
  decisionAppropriate?: boolean;
  breakdown?: {
    power: { score: number; grade: string; detail: string };
    pitch: { score: number; grade: string; detail: string };
    flap: { score: number; grade: string; detail: string };
    climb: { score: number; grade: string; detail: string };
  };
  failureConditions?: string[];
  safetyFailed?: boolean;
  coaching?: string[];
  // T&G / Landing specific
  touchdownHdg?: number;
  touchdownIas?: number;
  touchdownVs?: number;
  landingGrade?: string;   // VS severity label for landings
  // Commitment gate (GA only)
  commitmentGatePassed?: boolean;
  earlyGoAround?: boolean;
}

export interface GTGLResult {
  requiredSequence: string[];
  events: GTGLEvent[];
  state: GTGLState;
  counts: {
    goAroundsDetected: number;
    touchAndGosDetected: number;
    landingsDetected: number;
  };
  passConditions: {
    ga1Detected: boolean;
    tngDetected: boolean;
    ga2Detected: boolean;
    landDetected: boolean;
    sequenceComplete: boolean;
    noSafetyFailures: boolean;
  };
  safetyBanner: boolean;
}

/**
 * Build the GTGL result from detected events.
 *
 * Uses go-around events, touch-and-go phases, and landing phases
 * to assemble and validate the 4-event sequence.
 */
export function buildGTGLResult(
  gaEvents: GoAroundEvent[],
  gaScores: GoAroundScore[],
  tngPhases: FlightPhase[],
  landingPhases: FlightPhase[],
  landingScores: LandingScore[],
): GTGLResult {
  const events: GTGLEvent[] = [];

  // Sort all events chronologically
  type ChronoEvent = { type: 'ga' | 'tng' | 'land'; t: number; idx: number };
  const chronoEvents: ChronoEvent[] = [];

  gaEvents.forEach((ev, i) => chronoEvents.push({ type: 'ga', t: ev.decisionT, idx: i }));
  tngPhases.forEach((ph, i) => chronoEvents.push({ type: 'tng', t: ph.startT, idx: i }));
  landingPhases.forEach((ph, i) => chronoEvents.push({ type: 'land', t: ph.startT, idx: i }));

  chronoEvents.sort((a, b) => a.t - b.t);

  // Walk the state machine: GA1 → TNG → GA2 → LAND
  let state: GTGLState = 'AWAITING_GA1';
  let gaCount = 0;
  let tngUsed = false;

  for (const ce of chronoEvents) {
    if (state === 'AWAITING_GA1' && ce.type === 'ga') {
      const gs = gaScores[ce.idx];
      const ev = gaEvents[ce.idx];
      events.push(makeGAEvent('GA1', ev, gs));
      state = 'AWAITING_TNG';
      gaCount++;
    } else if (state === 'AWAITING_TNG' && ce.type === 'tng') {
      const ph = tngPhases[ce.idx];
      events.push(makeTngEvent('TNG', ph));
      state = 'AWAITING_GA2';
      tngUsed = true;
    } else if (state === 'AWAITING_GA2' && ce.type === 'ga') {
      const gs = gaScores[ce.idx];
      const ev = gaEvents[ce.idx];
      events.push(makeGAEvent('GA2', ev, gs));
      state = 'AWAITING_LAND';
      gaCount++;
    } else if (state === 'AWAITING_LAND' && ce.type === 'land') {
      const ph = landingPhases[ce.idx];
      const ls = landingScores[ce.idx];
      events.push(makeLandEvent('LAND', ph, ls));
      state = 'COMPLETE';
      break;
    }
  }

  // Fill missing events
  if (!events.find(e => e.label === 'GA1')) {
    events.splice(0, 0, { type: 'go_around', label: 'GA1', detected: false, timestampT: null, score: 0, grade: 'Missing' });
  }
  if (!events.find(e => e.label === 'TNG')) {
    const insertAt = Math.min(1, events.length);
    events.splice(insertAt, 0, { type: 'touch_and_go', label: 'TNG', detected: false, timestampT: null, score: 0, grade: 'Missing' });
  }
  if (!events.find(e => e.label === 'GA2')) {
    const insertAt = Math.min(2, events.length);
    events.splice(insertAt, 0, { type: 'go_around', label: 'GA2', detected: false, timestampT: null, score: 0, grade: 'Missing' });
  }
  if (!events.find(e => e.label === 'LAND')) {
    events.push({ type: 'landing', label: 'LAND', detected: false, timestampT: null, score: 0, grade: 'Missing' });
  }

  const ga1 = events.find(e => e.label === 'GA1')!;
  const tng = events.find(e => e.label === 'TNG')!;
  const ga2 = events.find(e => e.label === 'GA2')!;
  const land = events.find(e => e.label === 'LAND')!;

  const anySafetyFailed = events.some(e => e.safetyFailed);
  const sequenceComplete = state === 'COMPLETE';

  return {
    requiredSequence: ['GA1', 'TNG', 'GA2', 'LAND'],
    events,
    state,
    counts: {
      goAroundsDetected: gaEvents.length,
      touchAndGosDetected: tngPhases.length,
      landingsDetected: landingPhases.length,
    },
    passConditions: {
      ga1Detected: ga1.detected,
      tngDetected: tng.detected,
      ga2Detected: ga2.detected,
      landDetected: land.detected,
      sequenceComplete,
      noSafetyFailures: !anySafetyFailed,
    },
    safetyBanner: anySafetyFailed,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────

function makeGAEvent(label: string, ev: GoAroundEvent, gs: GoAroundScore): GTGLEvent {
  return {
    type: 'go_around',
    label,
    detected: true,
    timestampT: ev.decisionT,
    score: gs.overallScore,
    grade: gs.overallGrade,
    altAglAtDecision: gs.altitudeAglAtDecision,
    decisionAppropriate: gs.decisionAppropriate,
    breakdown: {
      power: { score: gs.powerApplication.score, grade: gradeLabel(gs.powerApplication.score), detail: gs.powerApplication.details },
      pitch: { score: gs.pitchControl.score, grade: gradeLabel(gs.pitchControl.score), detail: gs.pitchControl.details },
      flap: { score: gs.flapManagement.score, grade: gradeLabel(gs.flapManagement.score), detail: gs.flapManagement.details },
      climb: { score: gs.climbPerformance.score, grade: gradeLabel(gs.climbPerformance.score), detail: gs.climbPerformance.details },
    },
    failureConditions: gs.failureConditions,
    safetyFailed: gs.failureConditions.length > 0,
    coaching: gs.coaching,
    commitmentGatePassed: undefined,  // Set by grader after evaluating commitment gate
    earlyGoAround: undefined,
  };
}

function makeTngEvent(label: string, ph: FlightPhase): GTGLEvent {
  const hdg = ph.metadata.touchdownHdg ?? 0;
  const ias = ph.metadata.touchdownIas ?? 0;
  const vsVal = ph.metadata.touchdownVs ?? 0;
  // T&G gets a basic score based on heading and IAS
  const hdgDev = Math.abs(hdg - 240); // Simple for now
  const baseScore = hdgDev < 10 && ias > 55 && ias < 80 ? 4 : hdgDev < 20 ? 3 : 2;
  return {
    type: 'touch_and_go',
    label,
    detected: true,
    timestampT: ph.startT,
    score: baseScore,
    grade: gradeLabel(baseScore),
    touchdownHdg: hdg,
    touchdownIas: ias,
    touchdownVs: vsVal,
  };
}

function makeLandEvent(label: string, ph: FlightPhase, ls?: LandingScore): GTGLEvent {
  if (ls) {
    return {
      type: 'landing',
      label,
      detected: true,
      timestampT: ph.startT,
      score: ls.overallScore,
      grade: ls.overallGrade,
      touchdownHdg: ph.metadata.touchdownHdg ?? 0,
      touchdownIas: ls.touchdownIasKias,
      touchdownVs: ls.touchdownVsFpm,
      landingGrade: ls.vsSeverityLabel,
    };
  }
  // Fallback if no landing score
  return {
    type: 'landing',
    label,
    detected: true,
    timestampT: ph.startT,
    score: 3,
    grade: gradeLabel(3),
    touchdownHdg: ph.metadata.touchdownHdg ?? 0,
    touchdownIas: ph.metadata.touchdownIas ?? 0,
  };
}

// END ST-963 Logic
