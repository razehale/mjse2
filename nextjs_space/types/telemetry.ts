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
  [key: string]: number;
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
