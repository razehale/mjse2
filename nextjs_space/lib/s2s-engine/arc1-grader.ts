// START ST-604 Arc 1 Graders L1–L4 (ported from Python)
// Updated ST-963: Integrated landing scorer, GTGL sequence detector,
// Commitment Gate, Early GA tagging, Safety Overrides, pattern cycle detection.

import { TelemetryDataFrame, col, val } from './telemetry-parser';
import { FlightPhase, detectPhases, detectPatternCycles } from './phase-detector';
import {
  VR, VY, V_APPROACH, V_DOWNWIND, RWY_24, RWY_06, RWY06_POWERLINE_MSL,
  PATTERN_ALT_MSL, KHMP_ELEVATION_MSL, headingDiff, headingDiffAbs,
  haversineFt, gradeLabel,
} from './constants';
import {
  MetricResult, PhaseResult, SafetyFlag, LessonResult,
  deviationScore, booleanScore, rangeScore, getArcTolerances,
  computePhaseScore, computeOverallScore, createEmptyResult,
} from './rubrics';
import {
  detectGoArounds, scoreGoAround, GoAroundEvent, GoAroundScore,
  evaluateCommitmentGate, isEarlyGoAround, CommitmentGateResult,
} from './maneuvers/go-around';
// START ST-963 Logic — New imports
import { scoreLanding, LandingScore } from './landing-scorer';
import { buildGTGLResult, GTGLResult } from './gtgl-sequence-detector';
// END ST-963 Logic

// ========== L1 — Long Walk ==========
export function gradeL1(df: TelemetryDataFrame, studentId = 'unknown', flightId = '', telemetryFile = ''): LessonResult {
  const tol = getArcTolerances('L1');
  const phases = detectPhases(df);
  const result = createEmptyResult('L1', flightId || makeFlightId(), studentId, telemetryFile);
  const t = col(df, 't');
  const hdgArr = col(df, 'hdg');
  const latArr = col(df, 'lat');
  const lonArr = col(df, 'lon');

  // 1. Taxi quality
  const taxiPhases = phases.filter(p => p.phase === 'TAXI');
  let taxiDistFt = 0;
  for (const tp of taxiPhases) {
    for (let i = tp.startIdx + 1; i <= tp.endIdx; i++) {
      taxiDistFt += haversineFt(latArr[i - 1], lonArr[i - 1], latArr[i], lonArr[i]);
    }
  }
  const taxiTarget = 500;
  const taxiScoreVal = taxiTarget > 0 ? Math.min(5, Math.max(1, (taxiDistFt / taxiTarget) * 3)) : 3;
  const taxiPr: PhaseResult = {
    phase: 'taxi', startT: taxiPhases[0]?.startT ?? 0, endT: taxiPhases[taxiPhases.length - 1]?.endT ?? 0,
    metrics: [{ name: 'taxi_distance_ft', value: Math.round(taxiDistFt), target: taxiTarget, tolerance: 200, score: Math.round(taxiScoreVal * 100) / 100, grade: gradeLabel(taxiScoreVal), detail: `Taxi distance: ${Math.round(taxiDistFt)} ft` }],
    score: 0, grade: '', coaching: [],
  };
  computePhaseScore(taxiPr);
  result.phases.push(taxiPr);

  // 2. Takeoff from Rwy 24
  const takeoffPhases = phases.filter(p => p.phase === 'TAKEOFF_ROLL');
  if (takeoffPhases.length > 0) {
    const tk = takeoffPhases[0];
    const tkHdg = hdgArr[tk.endIdx];
    const hdgDev = Math.abs(headingDiff(tkHdg, RWY_24.heading));
    const liftoffIas = tk.metadata.liftoffIas ?? 0;
    const tkPr: PhaseResult = {
      phase: 'takeoff', startT: tk.startT, endT: tk.endT,
      metrics: [
        { name: 'takeoff_heading_dev', value: Math.round(hdgDev * 10) / 10, target: 0, tolerance: tol.headingDeg, score: deviationScore(hdgDev, 0, tol.headingDeg), grade: gradeLabel(deviationScore(hdgDev, 0, tol.headingDeg)), detail: `Heading deviation from Rwy 24: ${hdgDev.toFixed(1)}°` },
        { name: 'liftoff_ias', value: Math.round(liftoffIas * 10) / 10, target: VR, tolerance: 5, score: deviationScore(liftoffIas, VR, 5), grade: gradeLabel(deviationScore(liftoffIas, VR, 5)), detail: `Liftoff IAS: ${Math.round(liftoffIas)} KIAS (target ${VR})` },
      ],
      score: 0, grade: '', coaching: [],
    };
    computePhaseScore(tkPr);
    result.phases.push(tkPr);
    if (hdgDev >= RWY_24.headingTolerance) {
      result.coachingBullets.push(`Takeoff heading was ${Math.round(tkHdg)}° — that's ${Math.round(hdgDev)}° off Rwy 24 (240°). Check your alignment before adding power.`);
    }
  } else {
    result.phases.push({ phase: 'takeoff', startT: 0, endT: 0, metrics: [{ name: 'takeoff_detected', value: 0, target: 1, tolerance: 0, score: 1, grade: 'Rough', detail: 'No takeoff detected in telemetry' }], score: 1, grade: 'Rough', coaching: [] });
    result.coachingBullets.push('No takeoff was detected. Did you get airborne?');
  }

  // 3. Pattern circuit
  const hasDownwind = phases.some(p => p.phase === 'DOWNWIND');
  const hasFinal = phases.some(p => p.phase === 'FINAL');
  const patternPr: PhaseResult = {
    phase: 'pattern_circuit', startT: 0, endT: 0,
    metrics: [
      { name: 'downwind_detected', value: hasDownwind ? 1 : 0, target: 1, tolerance: 0, score: booleanScore(hasDownwind), grade: gradeLabel(booleanScore(hasDownwind)), detail: '' },
      { name: 'final_detected', value: hasFinal ? 1 : 0, target: 1, tolerance: 0, score: booleanScore(hasFinal), grade: gradeLabel(booleanScore(hasFinal)), detail: '' },
    ],
    score: 0, grade: '', coaching: [],
  };
  computePhaseScore(patternPr);
  result.phases.push(patternPr);
  if (!hasDownwind || !hasFinal) result.coachingBullets.push('Pattern circuit incomplete — make sure you fly a full downwind + base + final.');

  // START ST-963 Logic — 4. Landing on Rwy 24 with VS-based scoring
  const landingPhases = phases.filter(p => p.phase === 'LANDING' || p.phase === 'TOUCH_AND_GO');
  if (landingPhases.length > 0) {
    const ld = landingPhases[0];
    const tdVs = ld.metadata.touchdownVs ?? 0;
    const tdHdg = ld.metadata.touchdownHdg ?? 0;
    const tdIas = ld.metadata.touchdownIas ?? 0;
    const ls = scoreLanding(tdVs, tdHdg, tdIas, null, tol.headingDeg);
    const ldPr: PhaseResult = {
      phase: 'landing', startT: ld.startT, endT: ld.endT,
      metrics: [
        { name: 'touchdown_vs_fpm', value: ls.touchdownVsFpm, target: 0, tolerance: 150, score: ls.vsScore, grade: ls.vsSeverityLabel, detail: `Touchdown VS: ${ls.touchdownVsFpm} fpm (${ls.vsSeverityLabel})` },
        { name: 'heading_alignment', value: ls.headingDevDeg, target: 0, tolerance: tol.headingDeg, score: ls.headingScore, grade: gradeLabel(ls.headingScore), detail: `Heading deviation: ${ls.headingDevDeg}° from Rwy 240` },
        { name: 'touchdown_ias', value: ls.touchdownIasKias, target: V_APPROACH, tolerance: 5, score: ls.iasScore, grade: gradeLabel(ls.iasScore), detail: `Touchdown IAS: ${Math.round(tdIas)} KIAS` },
      ],
      score: ls.overallScore, grade: ls.overallGrade, coaching: [],
    };
    result.phases.push(ldPr);
  } else {
    result.phases.push({ phase: 'landing', startT: 0, endT: 0, metrics: [{ name: 'landing_detected', value: 0, target: 1, tolerance: 0, score: 1, grade: 'Rough', detail: 'No landing detected' }], score: 1, grade: 'Rough', coaching: [] });
    result.coachingBullets.push('No landing detected in the telemetry.');
  }
  // END ST-963 Logic

  addSafetyFlags(df, phases, result);
  computeOverallScore(result);
  result.passed = result.overallScore >= 3.0;
  generateCoaching(result);
  return result;
}

// ========== L2 — Configurator ==========
export function gradeL2(df: TelemetryDataFrame, studentId = 'unknown', flightId = '', telemetryFile = '', machadoQuizPct?: number): LessonResult {
  const tol = getArcTolerances('L2');
  const phases = detectPhases(df);
  const cycles = detectPatternCycles(phases);
  const result = createEmptyResult('L2', flightId || makeFlightId(), studentId, telemetryFile);

  // External: Machado quiz
  if (machadoQuizPct != null) {
    result.externalRequirements.machado_quiz_pct = machadoQuizPct;
    const quizPass = machadoQuizPct >= 80;
    result.externalRequirements.machado_quiz_pass = quizPass;
    if (!quizPass) result.coachingBullets.push(`Machado quiz score was ${Math.round(machadoQuizPct)}% — you need ≥80%. Review the ground topics before re-flying.`);
  } else {
    result.externalRequirements.machado_quiz_pct = null;
    result.externalRequirements.machado_quiz_pass = null;
    result.coachingBullets.push('Machado quiz score not provided — cannot evaluate ground portion.');
  }

  const completedCycles = cycles.filter(c => c.landingType !== 'INCOMPLETE');
  const nCycles = completedCycles.length;
  result.rawData.n_cycles_detected = nCycles;
  if (nCycles === 0) result.coachingBullets.push('No complete pattern cycles detected. L2 requires 3 cycles.');

  let flapPassCount = 0, trimPassCount = 0;
  const iasArr = col(df, 'ias');
  const vsArr = col(df, 'vs');
  const altAglArr = col(df, 'alt_agl');
  const altMslArr = col(df, 'alt_msl');
  const flapArr = col(df, 'flap_ratio');
  const pitchArr = col(df, 'pitch');
  const elvTrimArr = col(df, 'elv_trim');
  const hdgArr = col(df, 'hdg');

  // START ST-963 Logic — Grade each pattern cycle with per-leg scoring
  for (let ci = 0; ci < Math.min(completedCycles.length, 3); ci++) {
    const cycle = completedCycles[ci];
    const cycleLabel = `pattern_cycle_${ci + 1}`;
    const metrics: MetricResult[] = [];

    // Downwind leg scoring
    const downwinds = cycle.phases.filter(p => p.phase === 'DOWNWIND');
    if (downwinds.length > 0) {
      const dw = downwinds[downwinds.length - 1];
      const dwHdgDev = headingDiffAbs(dw.metadata.meanIas != null ? hdgArr[dw.startIdx] : 60, 60);
      let dwMeanIas = 0, dwCnt = 0;
      for (let k = dw.startIdx; k <= dw.endIdx; k++) { dwMeanIas += iasArr[k]; dwCnt++; }
      if (dwCnt > 0) dwMeanIas /= dwCnt;
      let dwMeanAlt = 0;
      for (let k = dw.startIdx; k <= dw.endIdx; k++) { dwMeanAlt += altMslArr[k]; }
      if (dwCnt > 0) dwMeanAlt /= dwCnt;
      const altDev = Math.abs(dwMeanAlt - PATTERN_ALT_MSL);

      metrics.push({
        name: 'downwind_ias', value: Math.round(dwMeanIas * 10) / 10, target: 90, tolerance: 10,
        score: deviationScore(dwMeanIas, V_DOWNWIND, 10), grade: gradeLabel(deviationScore(dwMeanIas, V_DOWNWIND, 10)),
        detail: `Downwind IAS: ${Math.round(dwMeanIas)} KIAS (target 90)`,
      });
      metrics.push({
        name: 'downwind_alt_msl', value: Math.round(dwMeanAlt), target: PATTERN_ALT_MSL, tolerance: 100,
        score: deviationScore(altDev, 0, 100), grade: gradeLabel(deviationScore(altDev, 0, 100)),
        detail: `Downwind altitude: ${Math.round(dwMeanAlt)} ft MSL (target ${PATTERN_ALT_MSL})`,
      });
    } else {
      metrics.push({ name: 'downwind_detected', value: 0, target: 1, tolerance: 0, score: 1, grade: 'Rough', detail: 'No downwind leg detected in this cycle' });
    }

    // Final approach scoring
    const finals = cycle.phases.filter(p => p.phase === 'FINAL');
    let meanAppIas = NaN, stabilized = false, flapOk = false, trimOk = false;

    if (finals.length > 0) {
      const f = finals[finals.length - 1];
      let sum = 0, cnt = 0;
      for (let k = f.startIdx; k <= f.endIdx; k++) { sum += iasArr[k]; cnt++; }
      if (cnt > 0) meanAppIas = sum / cnt;

      const lowIdxs: number[] = [];
      for (let k = f.startIdx; k <= f.endIdx; k++) { if (altAglArr[k] < 500) lowIdxs.push(k); }
      if (lowIdxs.length > 3) {
        const lowIas = lowIdxs.map(k => iasArr[k]);
        const lowVs = lowIdxs.map(k => vsArr[k]);
        stabilized = stdDev(lowIas) < 5 && stdDev(lowVs) < 200;
      }

      for (let k = f.startIdx + 1; k <= f.endIdx; k++) {
        if (Math.abs(flapArr[k] - flapArr[k - 1]) > 0.01) { flapOk = true; break; }
      }
      if (!flapOk) {
        for (const p of cycle.phases) {
          for (let k = p.startIdx + 1; k <= p.endIdx; k++) {
            if (Math.abs(flapArr[k] - flapArr[k - 1]) > 0.01) { flapOk = true; break; }
          }
          if (flapOk) break;
        }
      }

      const finalPitches: number[] = [];
      for (let k = f.startIdx; k <= f.endIdx; k++) finalPitches.push(pitchArr[k]);
      if (finalPitches.length > 5 && stdDev(finalPitches) < 2.0) trimOk = true;
      for (let k = f.startIdx + 1; k <= f.endIdx; k++) {
        if (Math.abs(elvTrimArr[k] - elvTrimArr[k - 1]) > 0.01) { trimOk = true; break; }
      }
    }

    if (flapOk) flapPassCount++;
    if (trimOk) trimPassCount++;

    if (!isNaN(meanAppIas)) {
      const speedScore = rangeScore(meanAppIas, 63, 67, tol.speedKias);
      metrics.push({ name: 'mean_approach_speed_kias', value: Math.round(meanAppIas * 10) / 10, target: 65, tolerance: tol.speedKias, score: speedScore, grade: gradeLabel(speedScore), detail: `Mean approach IAS: ${meanAppIas.toFixed(1)} KIAS (target 63-67)` });
    } else {
      metrics.push({ name: 'mean_approach_speed_kias', value: 0, target: 65, tolerance: tol.speedKias, score: 1, grade: 'Rough', detail: 'Could not measure approach speed' });
    }
    metrics.push({ name: 'stabilized_approach', value: stabilized ? 1 : 0, target: 1, tolerance: 0, score: booleanScore(stabilized), grade: gradeLabel(booleanScore(stabilized)), detail: `Stabilized approach: ${stabilized ? 'Yes' : 'No'}` });
    metrics.push({ name: 'flaps_sequence_correct', value: flapOk ? 1 : 0, target: 1, tolerance: 0, score: booleanScore(flapOk), grade: gradeLabel(booleanScore(flapOk)), detail: `Flap sequence: ${flapOk ? 'Correct' : 'Not detected'}` });
    metrics.push({ name: 'trim_set', value: trimOk ? 1 : 0, target: 1, tolerance: 0, score: booleanScore(trimOk), grade: gradeLabel(booleanScore(trimOk)), detail: `Trim set on final: ${trimOk ? 'Yes' : 'No'}` });

    // START ST-963 Logic — Per-cycle landing scoring with VS severity
    const cycleLanding = cycle.phases.filter(p => p.phase === 'LANDING' || p.phase === 'TOUCH_AND_GO');
    if (cycleLanding.length > 0) {
      const ld = cycleLanding[cycleLanding.length - 1];
      const tdVs = ld.metadata.touchdownVs ?? 0;
      const tdHdg = ld.metadata.touchdownHdg ?? 0;
      const tdIas = ld.metadata.touchdownIas ?? 0;
      const ls = scoreLanding(tdVs, tdHdg, tdIas, null, tol.headingDeg);
      metrics.push({ name: 'touchdown_vs_fpm', value: ls.touchdownVsFpm, target: 0, tolerance: 150, score: ls.vsScore, grade: ls.vsSeverityLabel, detail: `Touchdown VS: ${ls.touchdownVsFpm} fpm (${ls.vsSeverityLabel})` });
      metrics.push({ name: 'heading_alignment', value: ls.headingDevDeg, target: 0, tolerance: tol.headingDeg, score: ls.headingScore, grade: gradeLabel(ls.headingScore), detail: `Heading deviation: ${ls.headingDevDeg}° from Rwy 240` });
      metrics.push({ name: 'touchdown_ias', value: ls.touchdownIasKias, target: V_APPROACH, tolerance: 5, score: ls.iasScore, grade: gradeLabel(ls.iasScore), detail: `Touchdown IAS: ${Math.round(tdIas)} KIAS` });
    }
    // END ST-963 Logic

    const cyclePr: PhaseResult = { phase: cycleLabel, startT: cycle.phases[0]?.startT ?? 0, endT: cycle.phases[cycle.phases.length - 1]?.endT ?? 0, metrics, score: 0, grade: '', coaching: [] };
    computePhaseScore(cyclePr);
    result.phases.push(cyclePr);
  }

  result.rawData.flap_pass_count = flapPassCount;
  result.rawData.trim_pass_count = trimPassCount;
  result.rawData.flap_2of3 = flapPassCount >= 2;
  result.rawData.trim_2of3 = trimPassCount >= 2;
  if (nCycles < 3) result.coachingBullets.push(`Only ${nCycles} pattern cycle(s) detected — L2 requires 3.`);
  if (flapPassCount < 2) result.coachingBullets.push(`Flap sequence correct in only ${flapPassCount}/3 cycles (need 2/3).`);
  if (trimPassCount < 2) result.coachingBullets.push(`Trim set correctly in only ${trimPassCount}/3 cycles (need 2/3).`);

  addSafetyFlags(df, phases, result);

  // START ST-963 Logic — GTGL detection with Commitment Gate + Early GA + Safety Overrides
  const gaEvents = detectGoArounds(df);
  const gaScores: GoAroundScore[] = gaEvents.map(ev => scoreGoAround(df, ev));
  result.rawData.go_arounds_detected = gaEvents.length;

  // Evaluate Commitment Gate and Early GA for each go-around
  const commitmentResults: CommitmentGateResult[] = gaEvents.map(ev => evaluateCommitmentGate(df, ev));
  const earlyGaFlags: boolean[] = gaEvents.map(ev => isEarlyGoAround(df, ev));

  // Apply Commitment Gate enforcement:
  // - If commitment gate fails, cap score at 2
  // - If early GA, force score ≤ 2 and tag EARLY_GO_AROUND
  // - Safety overrides: stall/touchdown/sink after power → score=1
  for (let gi = 0; gi < gaScores.length; gi++) {
    const gs = gaScores[gi];
    const commitment = commitmentResults[gi];
    const early = earlyGaFlags[gi];

    if (!commitment.passed) {
      gs.overallScore = Math.min(gs.overallScore, 2.0);
      gs.overallGrade = gradeLabel(gs.overallScore);
      gs.coaching.push(`Commitment gate not met: ${commitment.detail}`);
    }
    if (early) {
      gs.overallScore = Math.min(gs.overallScore, 2.0);
      gs.overallGrade = gradeLabel(gs.overallScore);
      gs.coaching.push('EARLY_GO_AROUND: GA initiated too high/far from runway — no credit above Developing.');
    }
    // Safety overrides already handled in scoreGoAround (stall, touchdown, continued sink)
  }

  // Add per go-around PhaseResult
  gaScores.forEach((gs, gi) => {
    const ev = gaEvents[gi];
    const commitment = commitmentResults[gi];
    const early = earlyGaFlags[gi];
    const gaPr: PhaseResult = {
      phase: `go_around_${gi + 1}`,
      startT: ev.decisionT,
      endT: ev.decisionT + 30,
      metrics: [
        { name: 'power_application', value: gs.powerApplication.score, target: 5, tolerance: 1, score: gs.powerApplication.score, grade: gradeLabel(gs.powerApplication.score), detail: gs.powerApplication.details },
        { name: 'pitch_control', value: gs.pitchControl.score, target: 5, tolerance: 1, score: gs.pitchControl.score, grade: gradeLabel(gs.pitchControl.score), detail: gs.pitchControl.details },
        { name: 'flap_management', value: gs.flapManagement.score, target: 5, tolerance: 1, score: gs.flapManagement.score, grade: gradeLabel(gs.flapManagement.score), detail: gs.flapManagement.details },
        { name: 'climb_performance', value: gs.climbPerformance.score, target: 5, tolerance: 1, score: gs.climbPerformance.score, grade: gradeLabel(gs.climbPerformance.score), detail: gs.climbPerformance.details },
      ],
      score: gs.overallScore,
      grade: gs.overallGrade,
      coaching: gs.coaching,
    };
    result.phases.push(gaPr);
    for (const b of gs.coaching) result.coachingBullets.push(b);
    for (const f of gs.failureConditions) {
      result.safetyFlags.push({ timestamp: ev.decisionT, flagType: 'GO_AROUND_FAILURE', severity: 'high', description: f });
    }
    // Tag early GA as safety flag
    if (early) {
      result.safetyFlags.push({ timestamp: ev.decisionT, flagType: 'EARLY_GO_AROUND', severity: 'medium', description: `GA${gi + 1} initiated early — too high/far from runway. Score capped at 2.` });
    }
  });

  // Build GTGL sequence from detected events
  const tngPhases = phases.filter(p => p.phase === 'TOUCH_AND_GO');
  const fullLandingPhases = phases.filter(p => p.phase === 'LANDING');
  const landingScoresArr: LandingScore[] = fullLandingPhases.map(ph => {
    const tdVs = ph.metadata.touchdownVs ?? 0;
    const tdHdg = ph.metadata.touchdownHdg ?? 0;
    const tdIas = ph.metadata.touchdownIas ?? 0;
    return scoreLanding(tdVs, tdHdg, tdIas, null, tol.headingDeg);
  });

  const gtgl = buildGTGLResult(gaEvents, gaScores, tngPhases, fullLandingPhases, landingScoresArr);

  // Annotate GTGL events with commitment gate info
  for (let i = 0; i < gtgl.events.length; i++) {
    const ev = gtgl.events[i];
    if (ev.type === 'go_around' && ev.detected) {
      const gaIdx = ev.label === 'GA1' ? 0 : ev.label === 'GA2' ? 1 : -1;
      if (gaIdx >= 0 && gaIdx < commitmentResults.length) {
        ev.commitmentGatePassed = commitmentResults[gaIdx].passed;
        ev.earlyGoAround = earlyGaFlags[gaIdx];
      }
    }
  }

  result.extras = result.extras ?? {};
  result.extras.l2_gtgl = gtgl;
  // Keep backward-compatible l2_glgl shape for UI compatibility
  result.extras.l2_glgl = {
    required_sequence: gtgl.requiredSequence,
    events: gtgl.events,
    counts: {
      go_arounds_detected: gtgl.counts.goAroundsDetected,
      landings_detected: gtgl.counts.landingsDetected,
      touch_and_gos_detected: gtgl.counts.touchAndGosDetected,
    },
    pass_conditions: {
      two_go_arounds: gtgl.counts.goAroundsDetected >= 2,
      two_landings: gtgl.counts.landingsDetected >= 1, // GTGL only needs 1 final landing
      sequence_complete: gtgl.passConditions.sequenceComplete,
      no_safety_failures: gtgl.passConditions.noSafetyFailures,
    },
    safety_banner: gtgl.safetyBanner,
  };
  // END ST-963 Logic

  computeOverallScore(result);
  const quizOk = result.externalRequirements.machado_quiz_pass !== false;
  // START ST-963 Logic — L2 pass now requires GTGL sequence completion
  const gtglPass =
    gtgl.passConditions.sequenceComplete &&
    gtgl.passConditions.noSafetyFailures;
  result.passed = result.overallScore >= 3 && nCycles >= 3 && flapPassCount >= 2 && trimPassCount >= 2 && gtglPass && quizOk;
  if (!gtgl.passConditions.sequenceComplete) result.coachingBullets.push('GTGL sequence incomplete — L2 requires Go-Around → Touch-and-Go → Go-Around → Landing.');
  if (gtgl.safetyBanner) result.coachingBullets.push('🚨 Safety failure during go-around — review failure conditions in the debrief.');
  // END ST-963 Logic
  generateCoaching(result);
  return result;
}

// ========== L3 — Edge of the Envelope ==========
export function gradeL3(df: TelemetryDataFrame, studentId = 'unknown', flightId = '', telemetryFile = '', checklistTime?: number): LessonResult {
  const phases = detectPhases(df);
  const result = createEmptyResult('L3', flightId || makeFlightId(), studentId, telemetryFile);
  const iasArr = col(df, 'ias');
  const altMslArr = col(df, 'alt_msl');
  const hdgArr = col(df, 'hdg');
  const rollArr = col(df, 'roll');

  if (checklistTime != null) {
    result.externalRequirements.checklist_time = checklistTime;
    result.externalRequirements.checklist_before_flight = checklistTime <= (col(df, 't')[0] ?? 0);
  } else {
    result.externalRequirements.checklist_time = null;
  }

  // Slow flight
  const slowPhases = phases.filter(p => p.phase === 'SLOW_FLIGHT');
  if (slowPhases.length > 0) {
    const sp = slowPhases[0];
    const meanIas = sp.metadata.meanIas ?? 0;
    const duration = sp.metadata.durationS ?? 0;
    const stallDuring = phases.some(p => p.phase === 'STALL_WARNING' && p.startT >= sp.startT && p.startT <= sp.endT);
    let slowScore = stallDuring ? 2 : 4;
    if (duration > 30) slowScore = Math.min(5, slowScore + 0.5);
    const slowPr: PhaseResult = {
      phase: 'slow_flight', startT: sp.startT, endT: sp.endT,
      metrics: [
        { name: 'mean_ias', value: Math.round(meanIas * 10) / 10, target: 55, tolerance: 5, score: Math.round(slowScore * 100) / 100, grade: gradeLabel(slowScore), detail: `Slow flight at ${Math.round(meanIas)} KIAS for ${Math.round(duration)}s` },
        { name: 'stall_free', value: !stallDuring ? 1 : 0, target: 1, tolerance: 0, score: booleanScore(!stallDuring), grade: gradeLabel(booleanScore(!stallDuring)), detail: '' },
      ],
      score: 0, grade: '', coaching: [],
    };
    computePhaseScore(slowPr);
    result.phases.push(slowPr);
  } else {
    result.phases.push({ phase: 'slow_flight', startT: 0, endT: 0, metrics: [{ name: 'slow_flight_detected', value: 0, target: 1, tolerance: 0, score: 1, grade: 'Rough', detail: 'No sustained slow flight detected' }], score: 1, grade: 'Rough', coaching: [] });
    result.coachingBullets.push('No slow flight maneuver detected.');
  }

  // Stalls
  const stallPhases = phases.filter(p => p.phase === 'STALL_WARNING');
  if (stallPhases.length > 0) {
    stallPhases.forEach((stall, si) => {
      const afterIdx = Math.min(stall.endIdx + 30, df.length - 1);
      const recoveryIas = iasArr[afterIdx] ?? 0;
      const stallIas = stall.metadata.minIas ?? 0;
      const recovered = recoveryIas > stallIas + 10;
      const stallPr: PhaseResult = {
        phase: `stall_${si + 1}`, startT: stall.startT, endT: stall.endT,
        metrics: [
          { name: 'min_ias', value: Math.round(stallIas * 10) / 10, target: 0, tolerance: 5, score: 3, grade: 'Solid', detail: `Min IAS during stall: ${Math.round(stallIas)}` },
          { name: 'recovery', value: recovered ? 1 : 0, target: 1, tolerance: 0, score: booleanScore(recovered), grade: gradeLabel(booleanScore(recovered)), detail: `Recovery: ${recovered ? 'Yes' : 'No'}` },
        ],
        score: 0, grade: '', coaching: [],
      };
      computePhaseScore(stallPr);
      result.phases.push(stallPr);
    });
  } else {
    result.coachingBullets.push('No power-off stall attempts detected.');
  }

  // Steep turns
  const steepPhases = phases.filter(p => p.phase === 'STEEP_TURN');
  if (steepPhases.length > 0) {
    steepPhases.forEach((tp, ti) => {
      const maxBank = tp.metadata.maxBank ?? 0;
      let totalHdgChange = 0;
      for (let k = tp.startIdx + 1; k <= tp.endIdx; k++) {
        let diff = Math.abs(hdgArr[k] - hdgArr[k - 1]);
        if (diff > 180) diff = 360 - diff;
        totalHdgChange += diff;
      }
      let minAlt = Infinity, maxAlt = -Infinity;
      for (let k = tp.startIdx; k <= tp.endIdx; k++) {
        if (altMslArr[k] < minAlt) minAlt = altMslArr[k];
        if (altMslArr[k] > maxAlt) maxAlt = altMslArr[k];
      }
      const altDev = maxAlt - minAlt;
      const bankScore = deviationScore(maxBank, 45, 5);
      const altScore = deviationScore(altDev, 0, 100);
      const turnScore = totalHdgChange >= 350 ? 4 : 2;
      const steepPr: PhaseResult = {
        phase: `steep_turn_${ti + 1}`, startT: tp.startT, endT: tp.endT,
        metrics: [
          { name: 'max_bank_deg', value: Math.round(maxBank * 10) / 10, target: 45, tolerance: 5, score: bankScore, grade: gradeLabel(bankScore), detail: '' },
          { name: 'heading_change_deg', value: Math.round(totalHdgChange * 10) / 10, target: 360, tolerance: 30, score: Math.round(turnScore * 100) / 100, grade: gradeLabel(turnScore), detail: '' },
          { name: 'altitude_deviation_ft', value: Math.round(altDev * 10) / 10, target: 0, tolerance: 100, score: altScore, grade: gradeLabel(altScore), detail: '' },
        ],
        score: 0, grade: '', coaching: [],
      };
      computePhaseScore(steepPr);
      result.phases.push(steepPr);
    });
  } else {
    result.coachingBullets.push('No steep turn maneuvers detected.');
  }

  addSafetyFlags(df, phases, result);
  computeOverallScore(result);
  result.passed = result.overallScore >= 3;
  generateCoaching(result);
  return result;
}

// ========== L4 — Arc 1 Check Flight ==========
export function gradeL4(df: TelemetryDataFrame, studentId = 'unknown', flightId = '', telemetryFile = '', machadoQuizPct?: number): LessonResult {
  const tol = getArcTolerances('L4');
  const phases = detectPhases(df);
  const result = createEmptyResult('L4', flightId || makeFlightId(), studentId, telemetryFile);
  const hdgArr = col(df, 'hdg');
  const iasArr = col(df, 'ias');
  const altMslArr = col(df, 'alt_msl');

  // Machado quiz
  if (machadoQuizPct != null) {
    result.externalRequirements.machado_quiz_pct = machadoQuizPct;
    const quizPass = machadoQuizPct >= 80;
    result.externalRequirements.machado_quiz_pass = quizPass;
    if (!quizPass) result.coachingBullets.push(`Machado quiz: ${Math.round(machadoQuizPct)}% — need ≥80%.`);
  } else {
    result.externalRequirements.machado_quiz_pct = null;
    result.externalRequirements.machado_quiz_pass = null;
  }

  const landingEvents = phases.filter(p => p.phase === 'LANDING' || p.phase === 'TOUCH_AND_GO');

  // START ST-963 Logic — Grade T&Gs with VS-based landing scorer
  for (let i = 0; i < Math.min(landingEvents.length, 5); i++) {
    const ev = landingEvents[i];
    const tdVs = ev.metadata.touchdownVs ?? 0;
    const tdHdg = ev.metadata.touchdownHdg ?? 0;
    const tdIas = ev.metadata.touchdownIas ?? 0;
    const ls = scoreLanding(tdVs, tdHdg, tdIas, null, tol.headingDeg);
    const tngPr: PhaseResult = {
      phase: `touch_and_go_${i + 1}`, startT: ev.startT, endT: ev.endT,
      metrics: [
        { name: 'touchdown_vs_fpm', value: ls.touchdownVsFpm, target: 0, tolerance: 150, score: ls.vsScore, grade: ls.vsSeverityLabel, detail: `Touchdown VS: ${ls.touchdownVsFpm} fpm (${ls.vsSeverityLabel})` },
        { name: 'heading_deviation', value: ls.headingDevDeg, target: 0, tolerance: tol.headingDeg, score: ls.headingScore, grade: gradeLabel(ls.headingScore), detail: '' },
        { name: 'touchdown_ias', value: ls.touchdownIasKias, target: V_APPROACH, tolerance: 3, score: ls.iasScore, grade: gradeLabel(ls.iasScore), detail: '' },
      ],
      score: ls.overallScore, grade: ls.overallGrade, coaching: [],
    };
    result.phases.push(tngPr);
  }
  // END ST-963 Logic

  // 6th: emergency landing on Rwy 06
  if (landingEvents.length >= 6) {
    const emg = landingEvents[5];
    const hdgDev06 = Math.abs(headingDiff(emg.metadata.touchdownHdg ?? 0, RWY_06.heading));
    const approachStart = Math.max(0, emg.startIdx - 60);
    let minAltMsl = 9999;
    for (let k = approachStart; k <= emg.startIdx; k++) {
      if (altMslArr[k] < minAltMsl) minAltMsl = altMslArr[k];
    }
    const powerlineClear = minAltMsl > RWY06_POWERLINE_MSL;
    const emgPr: PhaseResult = {
      phase: 'emergency_landing_rwy06', startT: emg.startT, endT: emg.endT,
      metrics: [
        { name: 'heading_deviation_rwy06', value: Math.round(hdgDev06 * 10) / 10, target: 0, tolerance: RWY_06.headingTolerance, score: deviationScore(hdgDev06, 0, RWY_06.headingTolerance), grade: gradeLabel(deviationScore(hdgDev06, 0, RWY_06.headingTolerance)), detail: `Emergency landing heading dev: ${hdgDev06.toFixed(1)}°` },
        { name: 'powerline_clearance', value: powerlineClear ? 1 : 0, target: 1, tolerance: 0, score: booleanScore(powerlineClear), grade: gradeLabel(booleanScore(powerlineClear)), detail: `Min alt near Rwy 06: ${Math.round(minAltMsl)} MSL (powerlines at ${RWY06_POWERLINE_MSL})` },
      ],
      score: 0, grade: '', coaching: [],
    };
    computePhaseScore(emgPr);
    result.phases.push(emgPr);
    if (!powerlineClear) {
      result.safetyFlags.push({ timestamp: emg.startT, flagType: 'OBSTACLE_PROXIMITY', severity: 'high', description: `Altitude dropped to ${Math.round(minAltMsl)} MSL near Rwy 06 — powerlines at ${RWY06_POWERLINE_MSL} MSL!` });
    }
  } else {
    result.coachingBullets.push(`Only ${landingEvents.length} landing(s) detected — L4 requires 5 T&Gs + 1 emergency.`);
  }

  addSafetyFlags(df, phases, result);
  computeOverallScore(result);
  const quizOk = result.externalRequirements.machado_quiz_pass !== false;
  result.passed = result.overallScore >= 3 && landingEvents.length >= 6 && quizOk;
  generateCoaching(result);
  return result;
}

// ========== Shared helpers ==========

function makeFlightId(): string {
  return new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 15);
}

function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((sum, v) => sum + (v - mean) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function addSafetyFlags(df: TelemetryDataFrame, phases: FlightPhase[], result: LessonResult): void {
  const altAgl = col(df, 'alt_agl');
  for (const p of phases) {
    if (p.phase === 'STALL_WARNING') {
      const minIas = p.metadata.minIas ?? 0;
      let nearGround = false;
      for (let k = p.startIdx; k <= p.endIdx; k++) {
        if (altAgl[k] < 500) { nearGround = true; break; }
      }
      const severity: 'high' | 'medium' = nearGround ? 'high' : 'medium';
      result.safetyFlags.push({
        timestamp: p.startT, flagType: 'STALL_WARNING', severity,
        description: `Stall warning at t=${p.startT.toFixed(1)}s — IAS dropped to ${Math.round(minIas)} KIAS${nearGround ? ' (LOW ALTITUDE!)' : ''}`,
      });
    }
  }
}

function generateCoaching(result: LessonResult): void {
  for (const phase of result.phases) {
    for (const m of phase.metrics) {
      if (m.score >= 4.5) {
        result.coachingBullets.push(`✅ ${m.name}: ${m.detail || String(m.value)} — excellent!`);
      } else if (m.score < 2.5 && m.detail) {
        result.coachingBullets.push(`⚠️ ${m.name}: ${m.detail} — needs work.`);
      }
    }
  }
  // Deduplicate
  result.coachingBullets = Array.from(new Set(result.coachingBullets));
  // Next-step
  if (result.passed) {
    const nextMap: Record<string, string> = { L1: 'L2', L2: 'L3', L3: 'L4', L4: 'L5' };
    result.coachingBullets.push(`🎯 You passed ${result.lessonId}! Cleared for ${nextMap[result.lessonId] ?? 'next lesson'}.`);
  } else {
    result.coachingBullets.push(`🔄 Re-fly ${result.lessonId} and focus on the items marked ⚠️ above.`);
  }
}

// END ST-604
