// START ST-603 Flight Phase Detector (ported from Python)

import { TelemetryDataFrame, col } from './telemetry-parser';
import {
  VR, V_APPROACH, PATTERN_ALT_MSL, KHMP_ELEVATION_MSL,
  RWY_24, headingDiff,
} from './constants';

export interface FlightPhase {
  phase: string;
  startIdx: number;
  endIdx: number;
  startT: number;
  endT: number;
  metadata: Record<string, any>;
}

export function detectPhases(df: TelemetryDataFrame): FlightPhase[] {
  const phases: FlightPhase[] = [];
  const n = df.length;
  if (n < 2) return phases;

  const onGround = col(df, 'on_ground');
  const ias = col(df, 'ias');
  const gs = col(df, 'gs');
  const vs = col(df, 'vs');
  const altAgl = col(df, 'alt_agl');
  const altMsl = col(df, 'alt_msl');
  const hdg = col(df, 'hdg');
  const roll = col(df, 'roll');
  const stallW = col(df, 'stall_warn');
  const t = col(df, 't');

  function add(phaseName: string, si: number, ei: number, meta: Record<string, any> = {}) {
    phases.push({ phase: phaseName, startIdx: si, endIdx: ei, startT: t[si], endT: t[ei], metadata: meta });
  }

  // Detect takeoff and landing events
  const takeoffs: number[] = [];
  const landings: number[] = [];
  for (let i = 1; i < n; i++) {
    if (onGround[i - 1] === 1 && onGround[i] === 0) takeoffs.push(i);
    if (onGround[i - 1] === 0 && onGround[i] === 1) landings.push(i);
  }

  // Tag taxi segments
  let i = 0;
  while (i < n) {
    if (onGround[i] === 1 && gs[i] > 0.5 && ias[i] < 40) {
      let j = i;
      while (j < n && onGround[j] === 1 && ias[j] < 40) j++;
      if ((t[Math.min(j, n - 1)] - t[i]) > 3) {
        add('TAXI', i, Math.min(j - 1, n - 1));
      }
      i = j;
    } else { i++; }
  }

  // Tag takeoff rolls
  for (const tkIdx of takeoffs) {
    let start = tkIdx;
    for (let k = tkIdx - 1; k >= Math.max(tkIdx - 300, 0); k--) {
      if (onGround[k] === 1 && ias[k] > 0) start = k;
      else break;
    }
    add('TAKEOFF_ROLL', start, tkIdx, { liftoffIas: ias[tkIdx] });
  }

  // Tag landings and touch-and-gos
  // START ST-963 Logic — Added touchdownVs to landing metadata
  for (const ldIdx of landings) {
    let isTng = false;
    for (const tkIdx of takeoffs) {
      if (tkIdx > ldIdx && (t[tkIdx] - t[ldIdx]) < 15) { isTng = true; break; }
    }
    const touchdownHdg = hdg[ldIdx];
    const touchdownIas = ias[ldIdx];
    const touchdownVs = vs[ldIdx];
    if (isTng) {
      add('TOUCH_AND_GO', ldIdx, Math.min(ldIdx + 5, n - 1), { touchdownHdg, touchdownIas, touchdownVs });
    } else {
      add('LANDING', ldIdx, Math.min(ldIdx + 5, n - 1), { touchdownHdg, touchdownIas, touchdownVs });
    }
  }
  // END ST-963 Logic

  // Tag airborne pattern legs
  const airborneSegs = getAirborneSegments(onGround, n);
  for (const [segStart, segEnd] of airborneSegs) {
    tagPatternLegs(t, hdg, altAgl, vs, ias, segStart, segEnd, phases);
  }

  // Tag stall warnings
  i = 0;
  while (i < n) {
    if (stallW[i] === 1 && onGround[i] === 0) {
      let j = i;
      while (j < n && stallW[j] === 1) j++;
      let minIas = Infinity;
      for (let k = i; k < j; k++) if (ias[k] < minIas) minIas = ias[k];
      add('STALL_WARNING', i, Math.min(j - 1, n - 1), { minIas });
      i = j;
    } else { i++; }
  }

  // Tag steep turns (bank >= 40° for >= 10s)
  i = 0;
  while (i < n) {
    if (Math.abs(roll[i]) >= 40 && onGround[i] === 0) {
      let j = i;
      while (j < n && Math.abs(roll[j]) >= 35) j++;
      const duration = t[Math.min(j - 1, n - 1)] - t[i];
      if (duration >= 10) {
        let maxBank = 0;
        for (let k = i; k < j; k++) if (Math.abs(roll[k]) > maxBank) maxBank = Math.abs(roll[k]);
        add('STEEP_TURN', i, Math.min(j - 1, n - 1), { maxBank, durationS: duration });
      }
      i = j;
    } else { i++; }
  }

  // Tag slow flight (IAS < 60, airborne, > 15s)
  i = 0;
  while (i < n) {
    if (ias[i] > 0 && ias[i] < 60 && onGround[i] === 0) {
      let j = i;
      while (j < n && ias[j] < 63 && onGround[j] === 0) j++;
      const duration = t[Math.min(j - 1, n - 1)] - t[i];
      if (duration >= 15) {
        let sum = 0;
        for (let k = i; k < j; k++) sum += ias[k];
        add('SLOW_FLIGHT', i, Math.min(j - 1, n - 1), { meanIas: sum / (j - i), durationS: duration });
      }
      i = j;
    } else { i++; }
  }

  phases.sort((a, b) => a.startT - b.startT);
  return phases;
}

export function detectPatternCycles(phases: FlightPhase[]): Array<{ cycleNum: number; phases: FlightPhase[]; landingType: string }> {
  const cycles: Array<{ cycleNum: number; phases: FlightPhase[]; landingType: string }> = [];
  let currentPhases: FlightPhase[] = [];
  let cycleNum = 0;
  const sorted = [...phases].sort((a, b) => a.startT - b.startT);

  for (const ph of sorted) {
    currentPhases.push(ph);
    if (ph.phase === 'LANDING' || ph.phase === 'TOUCH_AND_GO') {
      cycleNum++;
      cycles.push({ cycleNum, phases: [...currentPhases], landingType: ph.phase });
      currentPhases = [];
    }
  }
  if (currentPhases.length > 0) {
    cycles.push({ cycleNum: cycleNum + 1, phases: [...currentPhases], landingType: 'INCOMPLETE' });
  }
  return cycles;
}

// ── Internal helpers ──────────────────────────────────────────────────

function getAirborneSegments(onGround: number[], n: number): [number, number][] {
  const segs: [number, number][] = [];
  let i = 0;
  while (i < n) {
    if (onGround[i] === 0) {
      let j = i;
      while (j < n && onGround[j] === 0) j++;
      segs.push([i, j - 1]);
      i = j;
    } else { i++; }
  }
  return segs;
}

function inBand(h: number, target: number, tol: number = 35): boolean {
  return Math.abs(headingDiff(h, target)) < tol;
}

function tagPatternLegs(
  t: number[], hdg: number[], altAgl: number[], vs: number[], ias: number[],
  segStart: number, segEnd: number, phases: FlightPhase[]
) {
  const rwyHdg = RWY_24.heading; // 240
  const downwindHdg = (rwyHdg + 180) % 360; // 60
  const baseHdg = (rwyHdg - 90 + 360) % 360; // 150

  let i = segStart;
  while (i <= segEnd) {
    const h = hdg[i];
    const a = altAgl[i];

    // Climbout
    if (vs[i] > 100 && a < (PATTERN_ALT_MSL - KHMP_ELEVATION_MSL + 200) && inBand(h, rwyHdg, 40)) {
      let j = i;
      while (j <= segEnd && vs[j] > -100 && inBand(hdg[j], rwyHdg, 50)) j++;
      if ((t[Math.min(j, segEnd)] - t[i]) > 3) {
        phases.push({ phase: 'CLIMBOUT', startIdx: i, endIdx: Math.min(j - 1, segEnd), startT: t[i], endT: t[Math.min(j - 1, segEnd)], metadata: {} });
      }
      i = j; continue;
    }

    // Downwind
    if (inBand(h, downwindHdg, 35) && a > 500) {
      let j = i;
      while (j <= segEnd && inBand(hdg[j], downwindHdg, 45)) j++;
      if ((t[Math.min(j, segEnd)] - t[i]) > 5) {
        let sum = 0;
        for (let k = i; k < j && k <= segEnd; k++) sum += ias[k];
        phases.push({ phase: 'DOWNWIND', startIdx: i, endIdx: Math.min(j - 1, segEnd), startT: t[i], endT: t[Math.min(j - 1, segEnd)], metadata: { meanIas: sum / (j - i) } });
      }
      i = j; continue;
    }

    // Final approach
    if (inBand(h, rwyHdg, 30) && vs[i] < -50 && a < 800) {
      let j = i;
      while (j <= segEnd && inBand(hdg[j], rwyHdg, 40) && altAgl[j] > 0) j++;
      if ((t[Math.min(j, segEnd)] - t[i]) > 3) {
        let sumIas = 0, sumVs = 0;
        const cnt = Math.min(j, segEnd + 1) - i;
        for (let k = i; k < Math.min(j, segEnd + 1); k++) { sumIas += ias[k]; sumVs += vs[k]; }
        phases.push({ phase: 'FINAL', startIdx: i, endIdx: Math.min(j - 1, segEnd), startT: t[i], endT: t[Math.min(j - 1, segEnd)], metadata: { meanIas: sumIas / cnt, meanVs: sumVs / cnt } });
      }
      i = j; continue;
    }

    // Base
    if (inBand(h, baseHdg, 35) || inBand(h, (rwyHdg + 90) % 360, 35)) {
      const curTarget = inBand(h, baseHdg, 35) ? baseHdg : (rwyHdg + 90) % 360;
      let j = i;
      while (j <= segEnd && inBand(hdg[j], curTarget, 45)) j++;
      if ((t[Math.min(j, segEnd)] - t[i]) > 3) {
        phases.push({ phase: 'BASE', startIdx: i, endIdx: Math.min(j - 1, segEnd), startT: t[i], endT: t[Math.min(j - 1, segEnd)], metadata: {} });
      }
      i = j; continue;
    }

    i++;
  }
}

// END ST-603
