// ST-507: Flight Segmentation Service

import { TelemetryRow, FlightSegment, SegmentType } from '@/types/telemetry';

export function analyzeFlightSegments(rows: TelemetryRow[]): FlightSegment[] {
  if ((rows?.length ?? 0) < 10) return [];

  const segments: FlightSegment[] = [];
  let i = 0;

  while (i < (rows?.length ?? 0)) {
    const r = rows?.[i];
    if (!r) { i++; continue; }

    const onGround = (r?.on_ground ?? 0) > 0.5;
    const gs = r?.gs_kts ?? 0;
    const ias = r?.ias_kts ?? 0;
    const altAgl = r?.alt_agl ?? 0;
    const vsFpm = r?.vs_fpm ?? 0;

    if (onGround && gs < 5) {
      // Stationary on ground - preflight or full stop
      const start = i;
      while (i < (rows?.length ?? 0) && (rows?.[i]?.on_ground ?? 0) > 0.5 && (rows?.[i]?.gs_kts ?? 0) < 5) i++;
      segments.push(makeSegment('PREFLIGHT', rows, start, i - 1));
    } else if (onGround && gs >= 5) {
      // Taxi or takeoff roll
      const start = i;
      const startIas = ias;
      while (i < (rows?.length ?? 0) && (rows?.[i]?.on_ground ?? 0) > 0.5 && (rows?.[i]?.gs_kts ?? 0) >= 5) i++;
      const endIas = rows?.[Math.min(i - 1, (rows?.length ?? 1) - 1)]?.ias_kts ?? 0;
      if (endIas - startIas > 20) {
        segments.push(makeSegment('TAKEOFF_ROLL', rows, start, i - 1));
      } else {
        segments.push(makeSegment('TAXI', rows, start, i - 1));
      }
    } else if (!onGround) {
      // Airborne
      const start = i;
      // Check for liftoff transition
      if (i > 0 && (rows?.[i - 1]?.on_ground ?? 0) > 0.5) {
        segments.push(makeSegment('LIFTOFF', rows, i, i));
      }

      while (i < (rows?.length ?? 0) && (rows?.[i]?.on_ground ?? 0) < 0.5) {
        i++;
      }
      // Classify airborne segment
      const airSegment = classifyAirborneSegment(rows, start, i - 1);
      segments.push(...airSegment);

      // Check for landing
      if (i < (rows?.length ?? 0) && (rows?.[i]?.on_ground ?? 0) > 0.5) {
        // Is it touch-and-go or full stop?
        let touchAndGo = false;
        for (let j = i; j < Math.min(i + 100, rows?.length ?? 0); j++) {
          if ((rows?.[j]?.on_ground ?? 0) < 0.5) {
            touchAndGo = true;
            break;
          }
          if ((rows?.[j]?.t_sec ?? 0) - (rows?.[i]?.t_sec ?? 0) > 15) break;
        }
        segments.push(makeSegment(touchAndGo ? 'TOUCH_AND_GO' : 'LANDING', rows, i, i));
      }
    } else {
      i++;
    }
  }

  return segments;
}

function classifyAirborneSegment(rows: TelemetryRow[], start: number, end: number): FlightSegment[] {
  const segments: FlightSegment[] = [];
  if (start >= end) {
    segments.push(makeSegment('NEEDS_REVIEW', rows, start, end));
    return segments;
  }

  // Simple classification based on altitude trend and speed
  let i = start;
  while (i <= end) {
    const r = rows?.[i];
    if (!r) { i++; continue; }
    const vsFpm = r?.vs_fpm ?? 0;
    const altAgl = r?.alt_agl ?? 0;

    if (vsFpm > 300 && altAgl < 800) {
      const segStart = i;
      while (i <= end && (rows?.[i]?.vs_fpm ?? 0) > 200) i++;
      segments.push(makeSegment('CLIMB', rows, segStart, i - 1));
    } else if (vsFpm < -300 && altAgl < 800) {
      const segStart = i;
      while (i <= end && (rows?.[i]?.vs_fpm ?? 0) < -200) i++;
      segments.push(makeSegment('APPROACH', rows, segStart, i - 1));
    } else if (altAgl >= 800 && altAgl <= 1200) {
      // Pattern altitude - try to classify leg by heading
      const segStart = i;
      while (i <= end && (rows?.[i]?.alt_agl ?? 0) >= 700 && (rows?.[i]?.alt_agl ?? 0) <= 1300) i++;
      segments.push(makeSegment('DOWNWIND', rows, segStart, i - 1, 'MEDIUM'));
    } else {
      const segStart = i;
      while (i <= end && !(
        (rows?.[i]?.vs_fpm ?? 0) > 300 ||
        (rows?.[i]?.vs_fpm ?? 0) < -300 ||
        ((rows?.[i]?.alt_agl ?? 0) >= 800 && (rows?.[i]?.alt_agl ?? 0) <= 1200)
      )) i++;
      if (i === segStart) i++;
      segments.push(makeSegment('NEEDS_REVIEW', rows, segStart, Math.min(i - 1, end)));
    }
  }

  return segments;
}

function makeSegment(
  type: SegmentType,
  rows: TelemetryRow[],
  start: number,
  end: number,
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH'
): FlightSegment {
  const safeStart = Math.max(0, start);
  const safeEnd = Math.min(end, (rows?.length ?? 1) - 1);
  const startRow = rows?.[safeStart];
  const endRow = rows?.[safeEnd];

  // Compute basic metrics for the segment
  let avgIas = 0, avgAlt = 0, maxVs = 0, minVs = 0;
  let count = 0;
  for (let i = safeStart; i <= safeEnd; i++) {
    const r = rows?.[i];
    if (!r) continue;
    avgIas += r?.ias_kts ?? 0;
    avgAlt += r?.alt_agl ?? 0;
    maxVs = Math.max(maxVs, r?.vs_fpm ?? 0);
    minVs = Math.min(minVs, r?.vs_fpm ?? 0);
    count++;
  }
  if (count > 0) {
    avgIas /= count;
    avgAlt /= count;
  }

  return {
    type,
    startIndex: safeStart,
    endIndex: safeEnd,
    startTime: startRow?.t_sec ?? 0,
    endTime: endRow?.t_sec ?? 0,
    confidence,
    metrics: {
      avgIas: Math.round(avgIas * 10) / 10,
      avgAltAgl: Math.round(avgAlt),
      maxVsFpm: Math.round(maxVs),
      minVsFpm: Math.round(minVs),
    },
  };
}
