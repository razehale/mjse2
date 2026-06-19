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

const BINARY_COLS = new Set([
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
export interface TelemetryMetadata {
  lesson_tag?: string;
  arc?: number;
  recorder_version?: number;
}

export interface TelemetryResult {
  dataframe: TelemetryDataFrame;
  metadata: TelemetryMetadata;
}

/**
 * Parse raw CSV text into a cleaned, resampled DataFrame with metadata.
 * Returns both the dataframe and any metadata found in the CSV header.
 */
export function loadTelemetry(csvText: string, resampleHz: number = 1.0): TelemetryResult {
  const { headers, dataRows, metadata } = parseCsvText(csvText);
  const renamed = renameColumns(headers);

  // Build column arrays
  const data: Record<string, number[]> = {};
  for (const col of renamed) {
    data[col] = [];
  }

  for (const row of dataRows) {
    for (let i = 0; i < renamed.length; i++) {
      const val = parseNumberToken(row[i]);
      data[renamed[i]].push(Number.isNaN(val) ? NaN : val);
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

  normalizeTelemetryData(data);

  let df: TelemetryDataFrame = { columns: renamed, data, length: dataRows.length };

  // Resample to target Hz
  if (resampleHz > 0 && data['t'] && df.length >= 2) {
    df = resample(df, resampleHz);
    normalizeTelemetryData(df.data);
  }

  return { dataframe: df, metadata };
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

function parseCsvText(text: string): { headers: string[]; dataRows: string[][]; separator: string; metadata: TelemetryMetadata } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const metadata: TelemetryMetadata = {};

  // Check first line for metadata (starts with #)
  let startIdx = 0;
  if (lines.length > 0 && lines[0].trim().startsWith('#')) {
    const metaLine = lines[0].trim();
    startIdx = 1; // Skip metadata line when looking for header
    
    // Parse metadata: # lesson_tag=L1 arc=1 recorder_version=5
    const metaContent = metaLine.substring(1).trim(); // Remove '#'
    const parts = metaContent.split(/\s+/);
    
    for (const part of parts) {
      const [key, value] = part.split('=').map(s => s.trim());
      if (key && value) {
        if (key === 'lesson_tag') {
          metadata.lesson_tag = value;
        } else if (key === 'arc') {
          const arcNum = parseInt(value, 10);
          if (!isNaN(arcNum)) metadata.arc = arcNum;
        } else if (key === 'recorder_version') {
          const versionNum = parseInt(value, 10);
          if (!isNaN(versionNum)) metadata.recorder_version = versionNum;
        }
      }
    }
  }

  // Find header line (first non-blank, non-separator line after metadata)
  let headerLine = '';
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const stripped = line.trim().replace(/^\|/, '').replace(/\|$/, '').trim();
    if (stripped && !stripped.match(/^[\s|:\-]+$/)) {
      headerLine = stripped;
      break;
    }
  }
  if (!headerLine) throw new Error('No header row found in telemetry CSV');

  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const pipeCount = (headerLine.match(/\|/g) ?? []).length;
  const sep = commaCount >= pipeCount ? ',' : '|';

  const headers = headerLine.split(sep).map(h => h.trim()).filter(h => h.length > 0);
  const headerNormalized = headerLine.replace(/\s+/g, '');

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
    if (/^[\s|:\-]+$/.test(stripped)) continue; // separator rows

    const normalized = stripped.replace(/^\|/, '').replace(/\|$/, '').trim();
    if (normalized.replace(/\s+/g, '') === headerNormalized) continue; // repeated full header

    const fields = normalized
      .split(sep)
      .map(f => f.trim().replace(/^\|/, '').replace(/\|$/, '').trim());

    if (fields.length >= headers.length) {
      dataRows.push(fields.slice(0, headers.length));
    } else if (fields.length >= Math.ceil(headers.length * 0.8)) {
      while (fields.length < headers.length) fields.push('NaN');
      dataRows.push(fields);
    }
  }

  return { headers, dataRows, separator: sep, metadata };
}

function renameColumns(headers: string[]): string[] {
  return headers.map(h => {
    const clean = h.trim();
    return COL_MAP[clean] || clean;
  });
}

function parseNumberToken(raw: string | undefined): number {
  if (raw == null) return NaN;

  let token = raw.trim().replace(/^\|/, '').replace(/\|$/, '').trim();
  if (!token) return NaN;

  token = token.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1').trim();
  if (!token) return NaN;

  const lower = token.toLowerCase();
  if (lower === 'nan' || lower === 'null' || lower === 'none') return NaN;

  if (token.includes(',') && !token.includes('.') && /^-?\d+,\d+$/.test(token)) {
    token = token.replace(',', '.');
  }

  const value = Number.parseFloat(token);
  return Number.isFinite(value) ? value : NaN;
}

function normalizeTelemetryData(data: Record<string, number[]>): void {
  // Normalize binary/integer flags to strict 0/1 so phase transitions can be detected reliably.
  for (const colName of Object.keys(data)) {
    if (!BINARY_COLS.has(colName)) continue;
    const arr = data[colName];
    for (let i = 0; i < arr.length; i++) {
      arr[i] = arr[i] >= 0.5 ? 1 : 0;
    }
  }

  // Keep AGL non-negative for flare/ground proximity logic.
  const altAgl = data['alt_agl'];
  if (altAgl && altAgl.length > 0) {
    const positiveCount = altAgl.filter(v => v > 0).length;
    const negativeCount = altAgl.filter(v => v < 0).length;

    // If AGL appears mostly inverted, flip sign once.
    if (negativeCount > positiveCount * 2) {
      for (let i = 0; i < altAgl.length; i++) altAgl[i] = -altAgl[i];
    }

    // Clamp mild negatives (sampling noise around touchdown) to zero.
    for (let i = 0; i < altAgl.length; i++) {
      if (altAgl[i] < 0 && altAgl[i] > -20) altAgl[i] = 0;
    }
  }

  // Detect inverted VS sign (some recorders export descent as positive).
  // Compare VS sign to d(AGL)/dt sign; if mostly opposite, flip VS.
  const vs = data['vs'];
  const t = data['t'];
  if (vs && altAgl && t && vs.length === altAgl.length && t.length === altAgl.length) {
    let agree = 0;
    let disagree = 0;

    for (let i = 1; i < vs.length; i++) {
      const dt = t[i] - t[i - 1];
      if (dt <= 0.001) continue;

      const da = altAgl[i] - altAgl[i - 1];
      const vsFps = vs[i] / 60.0;

      if (Math.abs(da) < 0.3 || Math.abs(vsFps) < 0.3) continue;

      if (Math.sign(da) === Math.sign(vsFps)) agree++;
      else disagree++;
    }

    if (disagree >= 5 && disagree > agree * 1.2) {
      for (let i = 0; i < vs.length; i++) vs[i] = -vs[i];
    }
  }
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
    if (BINARY_COLS.has(colName)) {
      newData[colName] = interpolated.map(v => (v >= 0.5 ? 1 : 0));
    } else if (INT_COLS.has(colName)) {
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

export const __telemetryParserInternals = {
  parseCsvText,
  renameColumns,
  parseNumberToken,
  normalizeTelemetryData,
};

// END ST-602
