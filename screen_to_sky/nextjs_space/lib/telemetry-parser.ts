// ST-505: Telemetry CSV Parser
// Handles flexible schema - missing columns won't crash

import { TelemetryRow, ParsedTelemetry, TelemetrySummary } from '@/types/telemetry';

const EXPECTED_COLUMNS = [
  't_sec', 'sim_time', 'lat', 'lon', 'alt_msl', 'alt_agl', 'ias_kts', 'gs_kts',
  'vs_fpm', 'pitch_deg', 'roll_deg', 'hdg_deg', 'aileron', 'elevator', 'rudder',
  'throttle', 'mixture', 'flap_ratio', 'elv_trim', 'rpm', 'mp_inhg', 'on_ground',
  'parking_brake', 'g_normal', 'slip_deg', 'stall_warn', 'chock_left', 'chock_right',
  'tiedown_left', 'tiedown_right', 'tiedown_tail', 'pitot_cover', 'head_yaw',
  'head_pitch', 'view_type', 'beacon_on', 'battery_on', 'avionics_on',
];

export function parseTelemetryCSV(csvContent: string): ParsedTelemetry {
  const lines = (csvContent ?? '').split('\n').filter((l: string) => l?.trim?.()?.length > 0);
  if ((lines?.length ?? 0) < 2) {
    return {
      rows: [],
      columns: [],
      rowCount: 0,
      durationSec: 0,
      summary: getEmptySummary(),
    };
  }

  const headerLine = lines?.[0] ?? '';
  const columns = headerLine.split(',').map((c: string) => c?.trim?.() ?? '');
  const columnIndexMap: Record<string, number> = {};
  columns.forEach((col: string, idx: number) => {
    columnIndexMap[col] = idx;
  });

  const rows: TelemetryRow[] = [];
  for (let i = 1; i < (lines?.length ?? 0); i++) {
    const values = (lines?.[i] ?? '').split(',');
    const row: any = {};
    for (const col of EXPECTED_COLUMNS) {
      const idx = columnIndexMap[col];
      if (idx !== undefined && idx < (values?.length ?? 0)) {
        const val = parseFloat(values?.[idx] ?? '0');
        row[col] = isNaN(val) ? 0 : val;
      } else {
        row[col] = 0;
      }
    }
    // Also include any extra columns
    for (const col of columns) {
      if (!EXPECTED_COLUMNS.includes(col) && col) {
        const idx = columnIndexMap[col];
        if (idx !== undefined && idx < (values?.length ?? 0)) {
          const val = parseFloat(values?.[idx] ?? '0');
          row[col] = isNaN(val) ? 0 : val;
        }
      }
    }
    rows.push(row as TelemetryRow);
  }

  const durationSec = (rows?.length ?? 0) > 0
    ? (rows[rows.length - 1]?.t_sec ?? 0) - (rows[0]?.t_sec ?? 0)
    : 0;

  const summary = computeSummary(rows);

  return {
    rows,
    columns: columns.filter((c: string) => EXPECTED_COLUMNS.includes(c)),
    rowCount: rows?.length ?? 0,
    durationSec,
    summary,
  };
}

function computeSummary(rows: TelemetryRow[]): TelemetrySummary {
  if ((rows?.length ?? 0) === 0) return getEmptySummary();

  let maxAltMsl = 0, maxAltAgl = 0, maxIas = 0, maxGs = 0;
  let maxVs = -99999, minVs = 99999;
  let maxRpm = 0, maxGLoad = 0, minGLoad = 99;
  let totalOnGround = 0, totalInAir = 0;
  let landingCount = 0, touchAndGoCount = 0;
  let prevOnGround = rows?.[0]?.on_ground ?? 1;

  for (let i = 0; i < (rows?.length ?? 0); i++) {
    const r = rows?.[i];
    if (!r) continue;
    maxAltMsl = Math.max(maxAltMsl, r?.alt_msl ?? 0);
    maxAltAgl = Math.max(maxAltAgl, r?.alt_agl ?? 0);
    maxIas = Math.max(maxIas, r?.ias_kts ?? 0);
    maxGs = Math.max(maxGs, r?.gs_kts ?? 0);
    maxVs = Math.max(maxVs, r?.vs_fpm ?? 0);
    minVs = Math.min(minVs, r?.vs_fpm ?? 0);
    maxRpm = Math.max(maxRpm, r?.rpm ?? 0);
    maxGLoad = Math.max(maxGLoad, r?.g_normal ?? 0);
    minGLoad = Math.min(minGLoad, r?.g_normal ?? 0);

    const dt = i > 0 ? (r?.t_sec ?? 0) - (rows?.[i - 1]?.t_sec ?? 0) : 0;
    if ((r?.on_ground ?? 0) > 0.5) {
      totalOnGround += dt;
    } else {
      totalInAir += dt;
    }

    const currentOnGround = (r?.on_ground ?? 0) > 0.5 ? 1 : 0;
    if (currentOnGround === 1 && prevOnGround === 0) {
      landingCount++;
      // Check if touch-and-go: if within 10 seconds we're airborne again
      let isTouchAndGo = false;
      for (let j = i + 1; j < Math.min(i + 100, rows?.length ?? 0); j++) {
        if ((rows?.[j]?.on_ground ?? 0) < 0.5) {
          isTouchAndGo = true;
          break;
        }
        if ((rows?.[j]?.t_sec ?? 0) - (r?.t_sec ?? 0) > 15) break;
      }
      if (isTouchAndGo) touchAndGoCount++;
    }
    prevOnGround = currentOnGround;
  }

  return {
    maxAltMsl,
    maxAltAgl,
    maxIas,
    maxGs,
    maxVs,
    minVs: minVs === 99999 ? 0 : minVs,
    maxRpm,
    maxGLoad,
    minGLoad: minGLoad === 99 ? 0 : minGLoad,
    totalTimeOnGround: Math.round(totalOnGround),
    totalTimeInAir: Math.round(totalInAir),
    landingCount,
    touchAndGoCount,
  };
}

function getEmptySummary(): TelemetrySummary {
  return {
    maxAltMsl: 0, maxAltAgl: 0, maxIas: 0, maxGs: 0,
    maxVs: 0, minVs: 0, maxRpm: 0, maxGLoad: 0, minGLoad: 0,
    totalTimeOnGround: 0, totalTimeInAir: 0, landingCount: 0, touchAndGoCount: 0,
  };
}
