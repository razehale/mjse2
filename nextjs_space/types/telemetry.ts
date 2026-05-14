// ST-505: Telemetry data types

export interface TelemetryRow {
  t_sec: number;
  sim_time: number;
  lat: number;
  lon: number;
  alt_msl: number;
  alt_agl: number;
  ias_kts: number;
  gs_kts: number;
  vs_fpm: number;
  pitch_deg: number;
  roll_deg: number;
  hdg_deg: number;
  aileron: number;
  elevator: number;
  rudder: number;
  throttle: number;
  mixture: number;
  flap_ratio: number;
  elv_trim: number;
  rpm: number;
  mp_inhg: number;
  on_ground: number;
  parking_brake: number;
  g_normal: number;
  slip_deg: number;
  stall_warn: number;
  chock_left: number;
  chock_right: number;
  tiedown_left: number;
  tiedown_right: number;
  tiedown_tail: number;
  pitot_cover: number;
  head_yaw: number;
  head_pitch: number;
  view_type: number;
  beacon_on: number;
  battery_on: number;
  avionics_on: number;
  // ── V5 fields (ST-911) — optional for backward compat with V4 CSVs ──
  alpha_deg?: number;
  beta_deg?: number;
  carb_heat?: number;
  flap_handle_dep?: number;
  fuel_total_kg?: number;
  g_side?: number;
  gear_deflect_mtr?: number;
  generator_on?: number;
  head_roll?: number;
  towbar?: number;
  wind_spd_kt?: number;
  wind_dir_deg?: number;
  light_beacon?: number;
  light_nav?: number;
  light_strobe?: number;
  light_landing?: number;
  light_taxi?: number;
  rep_fuel_pump?: number;
  rep_avionics?: number;
  rep_stall_on?: number;
  rep_stall_level?: number;
  rep_rpm?: number;
  rep_oil_temp_f?: number;
  rep_oil_psi?: number;
  rep_ff?: number;
  rep_cowl?: number;
  rep_cht_f?: number;
  rep_egt_f?: number;
  hdg_true_deg?: number;
  rep_preheat?: number;
  rep_plug_fouling?: number;
  rep_primer?: number;
  rep_magneto?: number;
  recorder_version?: number;
  [key: string]: number | undefined;
}

export interface FlightSegment {
  type: SegmentType;
  startIndex: number;
  endIndex: number;
  startTime: number;
  endTime: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  metrics: Record<string, number>;
}

export type SegmentType =
  | 'PREFLIGHT'
  | 'TAXI'
  | 'TAKEOFF_ROLL'
  | 'LIFTOFF'
  | 'CLIMB'
  | 'CROSSWIND'
  | 'DOWNWIND'
  | 'BASE'
  | 'FINAL'
  | 'APPROACH'
  | 'LANDING'
  | 'TOUCH_AND_GO'
  | 'FULL_STOP'
  | 'NEEDS_REVIEW';

export interface ParsedTelemetry {
  rows: TelemetryRow[];
  columns: string[];
  rowCount: number;
  durationSec: number;
  summary: TelemetrySummary;
}

export interface TelemetrySummary {
  maxAltMsl: number;
  maxAltAgl: number;
  maxIas: number;
  maxGs: number;
  maxVs: number;
  minVs: number;
  maxRpm: number;
  maxGLoad: number;
  minGLoad: number;
  totalTimeOnGround: number;
  totalTimeInAir: number;
  landingCount: number;
  touchAndGoCount: number;
}

// C172 Reference Constants (VALIDATED)
export const C172_CONSTANTS = {
  Vr: 55,          // Rotation speed (kts)
  Vy: 74,          // Best rate of climb (kts)
  Vdownwind: 90,   // Downwind speed (kts)
  Vapproach: 65,   // Approach speed (kts)
  Vglide: 68,      // Best glide speed (kts)
} as const;

// KHMP (Hampton) Constants
export const KHMP_CONSTANTS = {
  fieldElevation: 882,     // ft MSL
  patternAltitude: 1882,   // ft MSL (1000 AGL)
  patternAgl: 1000,        // ft AGL
  runway24Heading: 240,
  runway06Heading: 60,
} as const;
