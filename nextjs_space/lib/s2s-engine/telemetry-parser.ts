// START ST-602 Telemetry Parser (ported from Python)
// Handles FlyWithLua repeated headers, resamples to 1Hz

// Column mapping: raw CSV header → internal name
const COL_MAP: Record<string, string> = {
  t_sec: 't', sim_time: 'sim_time', lat: 'lat', lon: 'lon',
  alt_msl: 'alt_msl', alt_agl: 'alt_agl', ias_kts: 'ias', gs_kts: 'gs',
  vs_fpm: 'vs', pitch_deg: 'pitch', roll_deg: 'roll', hdg_deg: 'hdg',
  alpha_deg: 'alpha', aileron: 'aileron', elevator: 'elevator', rudder: 'rudder',
  throttle: 'throttle', mixture: 'mixture', carb_heat: 'carb_heat',
  flap_ratio: 'flap_ratio', flap_handle_dep: 'flap_handle', elv_trim: 'elv_trim',
  rpm: 'rpm', mp_inhg: 'mp', on_ground: 'on_ground', parking_brake: 'parking_brake',
  fuel_total_kg: 'fuel_kg', g_normal: 'g_normal', g_side: 'g_side',
  slip_deg: 'slip', stall_warn: 'stall_warn',
  rep_stall_on: 'rep_stall_on', rep_stall_level: 'rep_stall_level',
  gear_deflect_mtr: 'gear_deflect', wind_spd_kt: 'wind_spd', wind_dir_deg: 'wind_dir',
  light_beacon: 'light_beacon', light_nav: 'light_nav', light_strobe: 'light_strobe',
  light_landing: 'light_landing', light_taxi: 'light_taxi',
  battery_on: 'battery_on', generator_on: 'generator_on',
  rep_fuel_pump: 'fuel_pump', rep_avionics: 'avionics',
  chock_left: 'chock_left', chock_right: 'chock_right',
  tiedown_left: 'tiedown_left', tiedown_right: 'tiedown_right',
  tiedown_tail: 'tiedown_tail', pitot_cover: 'pitot_cover', towbar: 'towbar',
  rep_rpm: 'rep_rpm', rep_oil_temp_f: 'oil_temp', rep_oil_psi: 'oil_psi',
  rep_ff: 'fuel_flow', rep_cowl: 'cowl_flap', rep_cht_f: 'cht', rep_egt_f: 'egt',
  head_yaw: 'head_yaw', head_pitch: 'head_pitch', head_roll: 'head_roll',
  view_type: 'view_type',
  // ── V5 renames (ST-911) — keep V4 keys above for backward compat ──
  alt_msl_ft: 'alt_msl',       // V5 rename of alt_msl
  alt_agl_ft: 'alt_agl',       // V5 rename of alt_agl
  hdg_mag_deg: 'hdg',          // V5 rename of hdg_deg (magnetic heading)
  // ── V5 new columns (ST-911) ──
  hdg_true_deg: 'hdg_true',
  beta_deg: 'beta',
  rep_preheat: 'rep_preheat',
  rep_plug_fouling: 'rep_plug_fouling',
  rep_primer: 'rep_primer',
  rep_magneto: 'rep_magneto',
  recorder_version: 'recorder_version',
};

const INT_COLS = new Set([
  'on_ground', 'parking_brake', 'stall_warn', 'rep_stall_on',
  'light_beacon', 'light_nav', 'light_strobe', 'light_landing', 'light_taxi',
  'battery_on', 'generator_on', 'fuel_pump', 'avionics',
  'chock_left', 'chock_right', 'tiedown_left', 'tiedown_right',
  'tiedown_tail', 'pitot_cover', 'towbar',
]);

export interface TelemetryDataFrame {
  columns: string[];
  data: Record<string, number[]>;
  length: number;
}

/**
 * Parse raw CSV text into a cleaned, resampled DataFrame.
 */
export function loadTelemetry(csvText: string, resampleHz: number = 1.0): TelemetryDataFrame {
  const { headers, dataRows } = parseCsvText(csvText);
  const renamed = renameColumns(headers);

  // Build column arrays
  const data: Record<string, number[]> = {};
  for (const col of renamed) {
    data[col] = [];
  }

  for (const row of dataRows) {
    for (let i = 0; i < renamed.length; i++) {
      const val = parseFloat(row[i]);
      data[renamed[i]].push(isNaN(val) ? NaN : val);
    }
  }

  // Forward-fill NaN values
  for (const col of renamed) {
    const arr = data[col];
    // Forward fill
    for (let i = 1; i < arr.length; i++) {
      if (isNaN(arr[i])) arr[i] = arr[i - 1];
    }
    // Back fill leading NaN
    for (let i = arr.length - 2; i >= 0; i--) {
      if (isNaN(arr[i])) arr[i] = arr[i + 1];
    }
    // If still NaN, fill with 0
    for (let i = 0; i < arr.length; i++) {
      if (isNaN(arr[i])) arr[i] = 0;
    }
    // Round integer columns
    if (INT_COLS.has(col)) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.round(arr[i]);
      }
    }
  }

  let df: TelemetryDataFrame = { columns: renamed, data, length: dataRows.length };

  // Resample to target Hz
  if (resampleHz > 0 && data['t'] && df.length >= 2) {
    df = resample(df, resampleHz);
  }

  return df;
}

/** Get a column array or default zeros */
export function col(df: TelemetryDataFrame, name: string): number[] {
  return df.data[name] || new Array(df.length).fill(0);
}

/** Get value at index */
export function val(df: TelemetryDataFrame, name: string, idx: number): number {
  return df.data[name]?.[idx] ?? 0;
}

// ── Internal helpers ──────────────────────────────────────────────────

function parseCsvText(text: string): { headers: string[]; dataRows: string[][] } {
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  // Find header line (first non-blank, non-separator line)
  let headerLine = '';
  for (const line of lines) {
    const stripped = line.trim().replace(/^\|/, '').replace(/\|$/, '').trim();
    if (stripped && !stripped.match(/^[\s|:\-]+$/)) {
      headerLine = stripped;
      break;
    }
  }
  if (!headerLine) throw new Error('No header row found in telemetry CSV');

  const sep = headerLine.includes(',') && headerLine.split(',').length > 5 ? ',' : '|';
  const headers = headerLine.split(sep).map(h => h.trim()).filter(Boolean);
  const headerSet = new Set(headers);

  const dataRows: string[][] = [];
  let pastHeader = false;
  for (const line of lines) {
    if (!pastHeader) {
      const stripped = line.trim().replace(/^\|/, '').replace(/\|$/, '').trim();
      if (stripped === headerLine.trim()) { pastHeader = true; continue; }
      continue;
    }
    const stripped = line.trim();
    if (!stripped) continue;
    // Skip separator lines
    if (/^[\s|:\-]+$/.test(stripped)) continue;
    // Skip repeated header lines
    const firstField = stripped.split(sep)[0].trim().replace(/^\|/, '').replace(/\|$/, '').trim();
    if (headerSet.has(firstField)) continue;

    const fields = stripped.split(sep).map(f => f.trim().replace(/^\|/, '').replace(/\|$/, '').trim()).filter(Boolean);
    if (fields.length >= headers.length) {
      dataRows.push(fields.slice(0, headers.length));
    } else if (fields.length >= headers.length * 0.8) {
      while (fields.length < headers.length) fields.push('NaN');
      dataRows.push(fields);
    }
  }

  return { headers, dataRows };
}

function renameColumns(headers: string[]): string[] {
  return headers.map(h => {
    const clean = h.trim();
    return COL_MAP[clean] || clean;
  });
}

function resample(df: TelemetryDataFrame, hz: number): TelemetryDataFrame {
  const t = df.data['t'];
  const tMin = t[0];
  const tMax = t[t.length - 1];
  const step = 1.0 / hz;
  const newT: number[] = [];
  for (let v = tMin; v < tMax; v += step) {
    newT.push(Math.round(v * 1000) / 1000);
  }
  if (newT.length < 2) return df;

  const newData: Record<string, number[]> = { t: newT };
  for (const colName of df.columns) {
    if (colName === 't') continue;
    const src = df.data[colName];
    if (!src) continue;
    const interpolated = linearInterp(t, src, newT);
    if (INT_COLS.has(colName)) {
      newData[colName] = interpolated.map(v => Math.round(v));
    } else {
      newData[colName] = interpolated;
    }
  }

  return { columns: df.columns, data: newData, length: newT.length };
}

function linearInterp(xp: number[], fp: number[], x: number[]): number[] {
  const result: number[] = [];
  let j = 0;
  for (const xi of x) {
    while (j < xp.length - 2 && xp[j + 1] < xi) j++;
    if (j >= xp.length - 1) {
      result.push(fp[fp.length - 1]);
    } else {
      const t = (xp[j + 1] - xp[j]) === 0 ? 0 : (xi - xp[j]) / (xp[j + 1] - xp[j]);
      result.push(fp[j] + t * (fp[j + 1] - fp[j]));
    }
  }
  return result;
}

// END ST-602
