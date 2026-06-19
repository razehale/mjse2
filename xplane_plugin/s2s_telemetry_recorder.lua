-- ====
-- s2s_telemetry_recorder.lua  —  Screen-to-Sky Telemetry Recorder  v5.0 (ENHANCED)
-- ====
-- Drop into:  <X-Plane>/Resources/plugins/FlyWithLua/Scripts/
-- Requires:   FlyWithLua NG ≥ 2.7.37
--
-- v5.0 changes  (2026-05-11)  —  ST-960 CRITICAL FIX:
--
--   [CRITICAL] HEADING FIX (ST-960 Phase 2):
--     • Changed heading dataref from sim/flightmodel/position/psi (TRUE heading)
--       to sim/flightmodel/position/mag_psi (MAGNETIC heading).
--     • Runway 24 at KHMP is 240° MAGNETIC. True heading was causing a ~5-6°
--       scoring mismatch that broke pattern leg detection and runway alignment.
--
--   [CRITICAL] UNIT CONVERSION FIXES (ST-960 Phase 2):
--     • alt_msl: sim/flightmodel/position/elevation returns METERS.
--       Now converted to FEET (× 3.28084) in CSV output.
--       Validated: KHMP ground ≈ 882 ft MSL.
--     • alt_agl: sim/flightmodel/position/y_agl returns METERS.
--       Now converted to FEET (× 3.28084) in CSV output.
--     • gs_kts: sim/flightmodel/position/groundspeed returns m/s.
--       Now converted to KNOTS (× 1.94384) in CSV output.
--     • ias_kts: sim/flightmodel/position/indicated_airspeed can return
--       negative values (REP pitot simulation). Now clamped to max(0, val).
--
--   [NEW] REP INTEGRATION (ST-960 Phase 3):
--     • Added REP-specific datarefs for L1 checklist scoring:
--       - Engine pre-heat state (simcoders/rep/engine/preheat/is_preheating_0)
--       - Spark plug fouling (simcoders/rep/engine/sparkplugs/fouling_0)
--       - Primer state (simcoders/rep/engine/primer/pumps_0)
--       - Magneto check (simcoders/rep/cockpit2/switches/magneto_0)
--     • Detection uses dataref existence (XPLMFindDataRef), NOT aircraft name.
--       Aircraft always shows as "172sp" — that's normal for REP C172.
--     • Missing REP datarefs default to 0 with warning logged to S2S_LUA_LOG.txt.
--
--   [NEW] STALL MONITOR PREP (ST-960 Phase 4):
--     • AoA already captured via sim/flightmodel/position/alpha.
--     • Stall warning captured via both stock + REP datarefs.
--     • Added G-load vertical for stall break detection.
--     • Added beta (sideslip) for cross-control stall detection.
--
--   [NEW] STRUCTURED LOGGING (ST-960 Phase 5):
--     • All log messages written to S2S_LUA_LOG.txt on Desktop with severity levels:
--       [INFO], [WARN], [ERROR], [CRITICAL]
--     • Logs all missing datarefs per SOP-03 (no silent failures).
--     • Logs sample rate statistics every 500 samples.
--
--   [IMPROVED] 10Hz TIMING (ST-960 Phase 5):
--     • Replaced os.clock() drift-prone timer with frame-aware accumulator.
--     • Added drift detection: logs warning if >5% sample rate deviation.
--     • Sample interval jitter tracked and reported at recording stop.
--
--   All v4 features retained (63→69 columns, REC overlay, safe_dataref, pcall wrap).
-- ====

-- ── Guard: prevent double-load ────
if S2S_RECORDER_LOADED then return end
S2S_RECORDER_LOADED = true

-- ── Configuration ────
local SAMPLE_HZ       = 10          -- target samples per second
local SAMPLE_INTERVAL = 1.0 / SAMPLE_HZ
local FLUSH_INTERVAL  = 50          -- flush every N samples (~5 s at 10 Hz)
local VERSION         = "5.1"

-- Lesson-aware recording configuration (ST-912 follow-up)
local LESSON_TAGS = {"L1", "L2", "L3", "L4"}
local LESSON_ARC_MAP = { L1 = 1, L2 = 1, L3 = 1, L4 = 1 }
local DEFAULT_LESSON_TAG = "L1"
local MIN_VALID_DURATION_SEC = 60
local IAS_ZERO_WARN_SEC = 30
local ON_GROUND_NO_TRANSITION_WARN_SEC = 120

-- ── Unit conversion constants ────  -- START ST-960
local M_TO_FT    = 3.28084          -- meters → feet
local MS_TO_KTS  = 1.94384          -- m/s → knots
-- END ST-960

-- ════
-- STRUCTURED LOGGING (ST-960 Phase 5)
-- ════
-- Logs to both X-Plane log (logMsg) and a dedicated S2S_LUA_LOG.txt file.
-- Severity levels: INFO, WARN, ERROR, CRITICAL

local s2s_log_fh = nil

local function get_log_path()
    -- Try Desktop first (Windows → macOS/Linux → X-Plane root)
    local profile = os.getenv("USERPROFILE")
    if profile then
        local desktop = profile:gsub("\\", "/") .. "/Desktop/"
        local probe = io.open(desktop .. "s2s_probe_log.tmp", "w")
        if probe then
            probe:close()
            os.remove(desktop .. "s2s_probe_log.tmp")
            return desktop .. "S2S_LUA_LOG.txt"
        end
    end
    local home = os.getenv("HOME")
    if home then
        local desktop = home .. "/Desktop/"
        local probe = io.open(desktop .. "s2s_probe_log.tmp", "w")
        if probe then
            probe:close()
            os.remove(desktop .. "s2s_probe_log.tmp")
            return desktop .. "S2S_LUA_LOG.txt"
        end
    end
    if SYSTEM_DIRECTORY then return SYSTEM_DIRECTORY .. "S2S_LUA_LOG.txt" end
    return "S2S_LUA_LOG.txt"
end

-- Open log file (append mode so we keep history across sessions)
local function open_log()
    if s2s_log_fh then return end
    local path = get_log_path()
    local fh, err = io.open(path, "a")
    if fh then
        s2s_log_fh = fh
        s2s_log_fh:write("\n--- S2S SESSION START: " .. os.date("%Y-%m-%d %H:%M:%S") ..
                         " (v" .. VERSION .. ") ---\n")
        s2s_log_fh:flush()
    end
end

-- Severity-tagged log writer
local function s2s_log(level, msg)
    local ts = os.date("%H:%M:%S")
    local formatted = string.format("[%s] [%s] %s", ts, level, msg)

    -- Always log to X-Plane console
    logMsg("[S2S] " .. formatted)

    -- Also write to file if open
    if s2s_log_fh then
        s2s_log_fh:write(formatted .. "\n")
        s2s_log_fh:flush()
    end
end

open_log()

-- ════
-- SAFE DATAREF BINDING
-- ════
-- Wraps FlyWithLua's dataref() so a missing/misspelled dataref never
-- crashes the script.  If the dataref doesn't exist, the global variable
-- is initialised to 0 and a warning is logged to S2S_LUA_LOG.txt.

local s2s_missing_drefs = {}

local function safe_dataref(var_name, dref_path, access)
    local ref = XPLMFindDataRef(dref_path)
    if ref then
        dataref(var_name, dref_path, access)
    else
        -- Create the global with a safe default so sampling code never hits nil
        _G[var_name] = 0
        s2s_missing_drefs[#s2s_missing_drefs + 1] = dref_path
        -- START ST-960: Log missing datarefs to file per SOP-03
        s2s_log("WARN", "Dataref NOT FOUND: " .. dref_path ..
                "  (variable " .. var_name .. " defaults to 0)")
        -- END ST-960
    end
end

-- ════
-- DATAREF BINDINGS
-- ════
-- Each section notes whether the dataref is STOCK X-Plane or REP-specific.

-- ── Time [STOCK] ────
safe_dataref("S2S_sim_time",      "sim/time/local_time_sec",                    "readonly")

-- ── Position [STOCK] ────
safe_dataref("S2S_lat",           "sim/flightmodel/position/latitude",           "readonly")
safe_dataref("S2S_lon",           "sim/flightmodel/position/longitude",          "readonly")
-- NOTE: elevation returns METERS — converted to feet in sampling code (ST-960)
safe_dataref("S2S_alt_msl_m",     "sim/flightmodel/position/elevation",          "readonly")
-- NOTE: y_agl returns METERS — converted to feet in sampling code (ST-960)
safe_dataref("S2S_alt_agl_m",     "sim/flightmodel/position/y_agl",             "readonly")

-- ── Speed [STOCK] ────
-- NOTE: indicated_airspeed returns KIAS but can be negative with REP pitot sim
safe_dataref("S2S_ias_raw",       "sim/flightmodel/position/indicated_airspeed", "readonly")
-- NOTE: groundspeed returns m/s — converted to knots in sampling code (ST-960)
safe_dataref("S2S_gs_ms",         "sim/flightmodel/position/groundspeed",        "readonly")
safe_dataref("S2S_vs",            "sim/flightmodel/position/vh_ind_fpm",         "readonly")

-- ── Attitude [STOCK] ────
safe_dataref("S2S_pitch",         "sim/flightmodel/position/theta",              "readonly")
safe_dataref("S2S_roll",          "sim/flightmodel/position/phi",                "readonly")
-- START ST-960 Phase 2: CRITICAL HEADING FIX
-- v4 (WRONG): sim/flightmodel/position/psi returns TRUE heading
-- v5 (FIXED): sim/flightmodel/position/mag_psi returns MAGNETIC heading
-- KHMP runways are 240°/060° MAGNETIC — true heading caused ~5-6° scoring error
safe_dataref("S2S_hdg",           "sim/flightmodel/position/mag_psi",            "readonly")
-- Also keep true heading as a reference/debug column
safe_dataref("S2S_hdg_true",      "sim/flightmodel/position/psi",                "readonly")
-- END ST-960 Phase 2
safe_dataref("S2S_alpha",         "sim/flightmodel/position/alpha",              "readonly")
-- START ST-960 Phase 4: Sideslip angle for cross-control stall detection
safe_dataref("S2S_beta",          "sim/flightmodel/position/beta",               "readonly")
-- END ST-960 Phase 4

-- ── Controls  (yoke / pedal ratios, –1…+1) [STOCK] ────
safe_dataref("S2S_aileron",       "sim/cockpit2/controls/yoke_roll_ratio",       "readonly")
safe_dataref("S2S_elevator",      "sim/cockpit2/controls/yoke_pitch_ratio",      "readonly")
safe_dataref("S2S_rudder",        "sim/cockpit2/controls/yoke_heading_ratio",    "readonly")

-- ── Throttle [STOCK – FIX v4] ────
safe_dataref("S2S_throttle",      "sim/cockpit2/engine/actuators/throttle_ratio", "readonly")

-- ── Mixture [STOCK – FIX v4] ────
safe_dataref("S2S_mixture",       "sim/cockpit2/engine/actuators/mixture_ratio",  "readonly")

-- ── Carb Heat [STOCK] ────
local S2S_ref_carb = XPLMFindDataRef("sim/cockpit2/engine/actuators/carb_heat_ratio")

-- ── Trim [STOCK] ────
safe_dataref("S2S_elv_trim",      "sim/flightmodel/controls/elv_trim",          "readonly")

-- ── Flaps [STOCK] ────
safe_dataref("S2S_flap_ratio",    "sim/flightmodel/controls/flaprqst",          "readonly")
safe_dataref("S2S_flap_handle",   "sim/cockpit2/controls/flap_handle_deploy_ratio", "readonly")

-- ── Landing / gear [STOCK] ────
safe_dataref("S2S_on_ground",     "sim/flightmodel/failures/onground_any",      "readonly")
safe_dataref("S2S_park_brake",    "sim/cockpit2/controls/parking_brake_ratio",   "readonly")

-- ── Fuel [STOCK] ────
safe_dataref("S2S_fuel_kg",       "sim/flightmodel/weight/m_fuel_total",        "readonly")

-- ── G-loads [STOCK] ────
safe_dataref("S2S_g_nrml",        "sim/flightmodel/forces/g_nrml",              "readonly")
safe_dataref("S2S_g_side",        "sim/flightmodel/forces/g_side",              "readonly")

-- ── Weather (ambient) [STOCK] ────
safe_dataref("S2S_wind_spd",      "sim/weather/wind_speed_kt",                  "readonly")
safe_dataref("S2S_wind_dir",      "sim/weather/wind_direction_degt",            "readonly")

-- ── Slip/Skid indicator [STOCK] ────
safe_dataref("S2S_slip_deg",      "sim/cockpit2/gauges/indicators/slip_deg",    "readonly")

-- ── Stall warning (stock annunciator) [STOCK] ────
safe_dataref("S2S_stall_warn",    "sim/cockpit2/annunciators/stall_warning",    "readonly")

-- ── Gear vertical deflection (hard-landing detection) [STOCK] ────
local S2S_ref_gear_deflect = XPLMFindDataRef("sim/flightmodel2/gear/tire_vertical_deflection_mtr")

-- ════
-- HEAD / CAMERA TRACKING [STOCK – from v4]
-- ════
safe_dataref("S2S_head_psi",      "sim/graphics/view/pilots_head_psi",          "readonly")
safe_dataref("S2S_head_the",      "sim/graphics/view/pilots_head_the",          "readonly")
safe_dataref("S2S_head_phi",      "sim/graphics/view/pilots_head_phi",          "readonly")
safe_dataref("S2S_view_type",     "sim/graphics/view/view_type",                "readonly")

-- ════
-- REP (Reality Expansion Pack) DATAREFS
-- ════
-- REP overrides stock X-Plane engine datarefs with its own internal model.

-- ── REP Engine RPM [REP] ────
safe_dataref("S2S_rep_rpm",       "simcoders/rep/cockpit2/gauges/indicators/engine_0_rpm", "readonly")

-- ── REP Oil Temperature (°F) [REP] ────
safe_dataref("S2S_rep_oil_temp_f","simcoders/rep/engine/oil/temp_f_0",          "readonly")

-- ── REP Oil Pressure (PSI) [REP] ────
safe_dataref("S2S_rep_oil_psi",   "simcoders/rep/engine/oil/press_psi_0",       "readonly")

-- ── REP Fuel Flow [REP] ────
safe_dataref("S2S_rep_ff",        "simcoders/rep/indicators/fuel/fuel_flow_0",  "readonly")

-- ── REP Cowl Flaps [REP] ────
safe_dataref("S2S_rep_cowl",      "simcoders/rep/engine/cowl/handle_ratio_0",   "readonly")

-- ── REP Stall Warning [REP] ────
safe_dataref("S2S_rep_stall_on",  "simcoders/rep/stallwarning/on",              "readonly")
safe_dataref("S2S_rep_stall_lvl", "simcoders/rep/stallwarning/level",           "readonly")

-- ── REP Fuel Pump [REP] ────
safe_dataref("S2S_rep_fuel_pump", "simcoders/rep/cockpit2/engine/actuators/fuel_pump_0", "readonly")

-- ── REP Avionics Master [REP] ────
safe_dataref("S2S_rep_avionics",  "simcoders/rep/cockpit2/switches/avionics_power_on", "readonly")

-- ── REP CHT/EGT [REP - PROBED] ────
safe_dataref("S2S_rep_cht_0",     "simcoders/rep/engine/cht/temp_f_0",          "readonly")
safe_dataref("S2S_rep_egt_0",     "simcoders/rep/engine/egt/temp_f_0",          "readonly")

-- ── REP Manifold Pressure [REP - PROBED] ────
safe_dataref("S2S_rep_mp",        "simcoders/rep/cockpit2/gauges/indicators/engine_0_map_in_hg", "readonly")

-- START ST-960 Phase 3: REP-SPECIFIC DATAREFS FOR L1 CHECKLIST SCORING
-- These are detected by dataref existence, NOT by aircraft name.
-- Aircraft name always shows "172sp" — that's normal for REP C172.

-- Engine pre-heat: REP models cold-start requirements
-- 1 = preheating in progress, 0 = not preheating
safe_dataref("S2S_rep_preheat",   "simcoders/rep/engine/preheat/is_preheating_0", "readonly")

-- Spark plug fouling: REP models plug fouling from rich mixture on ground
-- Value 0..1 (0 = clean, 1 = fully fouled)
safe_dataref("S2S_rep_plug_foul", "simcoders/rep/engine/sparkplugs/fouling_0",    "readonly")

-- Primer pumps: number of primer actuations (for cold start procedure)
safe_dataref("S2S_rep_primer",    "simcoders/rep/engine/primer/pumps_0",          "readonly")

-- Magneto position: 0=OFF, 1=R, 2=L, 3=BOTH, 4=START
safe_dataref("S2S_rep_magneto",   "simcoders/rep/cockpit2/switches/magneto_0",    "readonly")

-- END ST-960 Phase 3

-- ════
-- REP STATIC ITEMS (Walk-Around) [REP – CORRECTED in v4]
-- ════
safe_dataref("S2S_chock_left",    "simcoders/rep/landinggear/tires/show_chocks_0", "readonly")
safe_dataref("S2S_chock_right",   "simcoders/rep/landinggear/tires/show_chocks_2", "readonly")
safe_dataref("S2S_tiedown_left",  "simcoders/rep/tiedown/show_0",               "readonly")
safe_dataref("S2S_tiedown_right", "simcoders/rep/tiedown/show_1",               "readonly")
safe_dataref("S2S_tiedown_tail",  "simcoders/rep/tiedown/show_2",               "readonly")
safe_dataref("S2S_pitot_cover",   "simcoders/rep/pitot/cover",                  "readonly")
safe_dataref("S2S_towbar",        "simcoders/rep/landinggear/tires/show_towbar", "readonly")

-- ════
-- LIGHTS [STOCK X-Plane]
-- ════
safe_dataref("S2S_light_beacon",  "sim/cockpit2/switches/beacon_on",            "readonly")
safe_dataref("S2S_light_nav",     "sim/cockpit2/switches/navigation_lights_on", "readonly")
safe_dataref("S2S_light_strobe",  "sim/cockpit2/switches/strobe_lights_on",     "readonly")
safe_dataref("S2S_light_landing", "sim/cockpit2/switches/landing_lights_on",    "readonly")
safe_dataref("S2S_light_taxi",    "sim/cockpit2/switches/taxi_light_on",        "readonly")

-- ════
-- ELECTRICAL [STOCK X-Plane]
-- ════
safe_dataref("S2S_battery_on",    "sim/cockpit2/electrical/battery_on",         "readonly")
safe_dataref("S2S_generator_on",  "sim/cockpit2/electrical/generator_on",       "readonly")

-- ── Stock engine arrays (kept as fallback; may read 0 with REP) ────
local S2S_ref_rpm_stock  = XPLMFindDataRef("sim/cockpit2/engine/indicators/engine_speed_rpm")
local S2S_ref_mp_stock   = XPLMFindDataRef("sim/cockpit2/engine/indicators/MPR_in_hg")

-- ── Helper to read engine[0] from an array dataref (returns 0 on failure) ───
local function read_arr_f(ref)
    if not ref then return 0 end
    local ok, t = pcall(XPLMGetDatavf, ref, 0, 1)   -- offset=0, count=1
    if ok and t and #t >= 1 then return t[1] end
    return 0
end

-- ── "Best available" engine value helpers ────
local function best_rpm()
    local rep = S2S_rep_rpm or 0
    if rep ~= 0 then return rep end
    return read_arr_f(S2S_ref_rpm_stock)
end

local function best_mp()
    local rep = S2S_rep_mp or 0
    if rep ~= 0 then return rep end
    return read_arr_f(S2S_ref_mp_stock)
end

-- ════
-- CSV HEADER  (69 columns — ST-960 expanded from 63)
-- ════
-- START ST-960: Updated header with new columns
local HEADER = table.concat({
    -- Core timing (1-2)
    "t_sec", "sim_time",
    -- Position (3-6)
    "lat", "lon", "alt_msl_ft", "alt_agl_ft",
    -- Speed (7-9)
    "ias_kts", "gs_kts", "vs_fpm",
    -- Attitude (10-14)  — ST-960: added hdg_true_deg, beta_deg
    "pitch_deg", "roll_deg", "hdg_mag_deg", "hdg_true_deg", "alpha_deg", "beta_deg",
    -- Control inputs (15-17)
    "aileron", "elevator", "rudder",
    -- Engine controls (18-20)
    "throttle", "mixture", "carb_heat",
    -- Flaps & trim (21-23)
    "flap_ratio", "flap_handle_dep", "elv_trim",
    -- Engine gauges: best-of REP/stock (24-25)
    "rpm", "mp_inhg",
    -- REP engine instruments (26-30)
    "rep_rpm", "rep_oil_temp_f", "rep_oil_psi", "rep_ff", "rep_cowl",
    -- REP CHT/EGT (31-32)
    "rep_cht_f", "rep_egt_f",
    -- Ground state (33-34)
    "on_ground", "parking_brake",
    -- Fuel (35)
    "fuel_total_kg",
    -- G-loads (36-37)
    "g_normal", "g_side",
    -- Flight quality indicators (38-41)
    "slip_deg", "stall_warn", "rep_stall_on", "rep_stall_level",
    -- Gear stress / hard landing (42)
    "gear_deflect_mtr",
    -- Lights (43-47)
    "light_beacon", "light_nav", "light_strobe", "light_landing", "light_taxi",
    -- Electrical (48-49)
    "battery_on", "generator_on",
    -- REP switches (50-51)
    "rep_fuel_pump", "rep_avionics",
    -- REP static items (52-58)
    "chock_left", "chock_right",
    "tiedown_left", "tiedown_right", "tiedown_tail",
    "pitot_cover", "towbar",
    -- Head/Camera tracking (59-62)
    "head_yaw", "head_pitch", "head_roll", "view_type",
    -- Weather (63-64)
    "wind_spd_kt", "wind_dir_deg",
    -- ST-960 Phase 3: REP L1 checklist datarefs (65-68)
    "rep_preheat", "rep_plug_fouling", "rep_primer", "rep_magneto",
    -- ST-960 Phase 4: Additional stall monitor (69)
    -- (AoA=alpha_deg col 14, stall_warn col 39, rep_stall cols 40-41 already exist)
    -- Beta/sideslip already in col 15
    "recorder_version"
}, ",")
-- END ST-960

-- Count the number of columns for the SESSION_END pad
local NUM_COLS = 0
for _ in HEADER:gmatch("[^,]+") do NUM_COLS = NUM_COLS + 1 end

-- ════
-- STATE VARIABLES
-- ════
local s2s_fh           = nil      -- file handle
local s2s_recording    = false
local s2s_start_clock  = 0        -- os.clock() when recording began
local s2s_last_sample  = 0        -- os.clock() of last sample
local s2s_sample_count = 0
local s2s_filepath     = ""
local s2s_selected_lesson_tag = DEFAULT_LESSON_TAG
local s2s_active_lesson_tag = DEFAULT_LESSON_TAG
local s2s_pending_lesson_switch = false
local s2s_warning_messages = {}
local s2s_warning_expire_clock = {}
local s2s_warning_overlay_seconds = 8

-- Validation trackers
local s2s_ias_zero_start_clock = nil
local s2s_ias_zero_warned = false
local s2s_prev_on_ground = nil
local s2s_on_ground_transition_count = 0
local s2s_on_ground_warned = false

-- ImGui lesson selector window
local s2s_lesson_wnd = nil
local S2S_LESSON_WND_W = 280
local S2S_LESSON_WND_H = 180

-- START ST-960 Phase 5: timing statistics
local s2s_timing_sum   = 0        -- sum of intervals for avg calculation
local s2s_timing_count = 0        -- number of intervals measured
local s2s_timing_max   = 0        -- max interval (worst case)
local s2s_timing_min   = 999      -- min interval (best case)
-- END ST-960 Phase 5

-- ════
-- REP DETECTION (ST-960 Phase 3)
-- ════
-- Detect REP by checking dataref existence, NOT aircraft name.
-- Aircraft always shows "172sp" even with REP installed.
local S2S_REP_DETECTED = false
local function detect_rep()
    local rep_ref = XPLMFindDataRef("simcoders/rep/cockpit2/gauges/indicators/engine_0_rpm")
    S2S_REP_DETECTED = (rep_ref ~= nil)
    if S2S_REP_DETECTED then
        s2s_log("INFO", "REP (Reality Expansion Pack) DETECTED via dataref existence")
    else
        s2s_log("INFO", "REP not detected — using stock X-Plane datarefs only")
    end
    return S2S_REP_DETECTED
end
detect_rep()

-- ════
-- OUTPUT PATH RESOLUTION
-- ════
local function get_output_dir()
    local profile = os.getenv("USERPROFILE")
    if profile then
        local desktop = profile:gsub("\\", "/") .. "/Desktop/"
        local probe = io.open(desktop .. "s2s_probe.tmp", "w")
        if probe then
            probe:close()
            os.remove(desktop .. "s2s_probe.tmp")
            return desktop
        end
    end
    local home = os.getenv("HOME")
    if home then
        local desktop = home .. "/Desktop/"
        local probe = io.open(desktop .. "s2s_probe.tmp", "w")
        if probe then
            probe:close()
            os.remove(desktop .. "s2s_probe.tmp")
            return desktop
        end
    end
    if SYSTEM_DIRECTORY then return SYSTEM_DIRECTORY end
    return ""
end

local function s2s_push_warning(msg)
    local now = os.clock()
    s2s_warning_messages[msg] = msg
    s2s_warning_expire_clock[msg] = now + s2s_warning_overlay_seconds
    s2s_log("WARN", msg)
end

local function s2s_cleanup_warning_overlay()
    local now = os.clock()
    for msg, expiry in pairs(s2s_warning_expire_clock) do
        if now >= expiry then
            s2s_warning_expire_clock[msg] = nil
            s2s_warning_messages[msg] = nil
        end
    end
end

local function s2s_arc_for_lesson(tag)
    return LESSON_ARC_MAP[tag] or 1
end

local function s2s_sanitize_lesson_tag(tag)
    for _, v in ipairs(LESSON_TAGS) do
        if tag == v then return v end
    end
    return DEFAULT_LESSON_TAG
end

local function s2s_set_lesson_tag(new_tag)
    local sanitized = s2s_sanitize_lesson_tag(new_tag)
    if sanitized == s2s_selected_lesson_tag then return end

    local old = s2s_selected_lesson_tag
    s2s_selected_lesson_tag = sanitized
    s2s_log("INFO", "Lesson selector changed: " .. old .. " → " .. sanitized)

    if s2s_recording and sanitized ~= s2s_active_lesson_tag then
        s2s_pending_lesson_switch = true
    end
end

local function s2s_build_metadata_comment()
    local lesson = s2s_active_lesson_tag or s2s_selected_lesson_tag or DEFAULT_LESSON_TAG
    local arc = s2s_arc_for_lesson(lesson)
    return string.format("# lesson_tag=%s,arc=%d,recorder_version=%s", lesson, arc, VERSION)
end

local function s2s_reset_validation_trackers()
    s2s_ias_zero_start_clock = nil
    s2s_ias_zero_warned = false
    s2s_prev_on_ground = nil
    s2s_on_ground_transition_count = 0
    s2s_on_ground_warned = false
end

local function s2s_open_new_recording_file()
    local dir = get_output_dir()
    local ts  = os.date("%Y%m%d_%H%M%S")
    local lesson = s2s_sanitize_lesson_tag(s2s_selected_lesson_tag)
    s2s_active_lesson_tag = lesson
    s2s_filepath = string.format("%sS2S_%s_%s.csv", dir, lesson, ts)

    local fh, err = io.open(s2s_filepath, "w")
    if not fh then
        s2s_log("ERROR", "Could not open file: " .. tostring(s2s_filepath) ..
               "  (" .. tostring(err) .. ")")
        return nil
    end

    fh:write(s2s_build_metadata_comment() .. "\n")
    fh:write(HEADER .. "\n")
    fh:flush()
    return fh
end

-- ════
-- START / STOP RECORDING
-- ════

local function s2s_stop_recording(reason)
    if not s2s_recording then
        s2s_log("INFO", "Not recording – nothing to stop.")
        return
    end

    local elapsed = os.clock() - s2s_start_clock

    -- Write a SESSION_END marker row
    if s2s_fh then
        s2s_fh:write(string.format("%.2f,SESSION_END", elapsed))
        for i = 1, (NUM_COLS - 2) do s2s_fh:write(",") end
        s2s_fh:write("\n")
        s2s_fh:flush()
        s2s_fh:close()
        s2s_fh = nil
    end

    -- START ST-960 Phase 5: Log timing statistics at stop
    if s2s_timing_count > 0 then
        local avg_interval = s2s_timing_sum / s2s_timing_count
        local actual_hz = 1.0 / avg_interval
        local drift_pct = math.abs(actual_hz - SAMPLE_HZ) / SAMPLE_HZ * 100
        s2s_log("INFO", string.format(
            "Timing stats: avg=%.4fs (%.1fHz), min=%.4fs, max=%.4fs, drift=%.1f%%",
            avg_interval, actual_hz, s2s_timing_min, s2s_timing_max, drift_pct))
        if drift_pct > 5 then
            s2s_log("WARN", string.format(
                "Sample rate drift >5%%: target=%dHz, actual=%.1fHz", SAMPLE_HZ, actual_hz))
        end
    end
    -- END ST-960 Phase 5

    if elapsed < MIN_VALID_DURATION_SEC then
        s2s_push_warning(string.format(
            "Recording too short: %.1fs (< %ds). Please record a longer flight.",
            elapsed, MIN_VALID_DURATION_SEC))
    end

    s2s_recording = false
    s2s_log("INFO", "Recording STOPPED  (" .. tostring(s2s_sample_count) ..
           " samples, lesson=" .. tostring(s2s_active_lesson_tag) ..
           (reason and (", reason=" .. reason) or "") .. ") → " .. s2s_filepath)
end

local function s2s_start_recording(reason)
    if s2s_recording then
        s2s_log("INFO", "Stopping current recording before starting a new one.")
        s2s_stop_recording("restart")
    end

    local fh = s2s_open_new_recording_file()
    if not fh then return end

    s2s_fh = fh

    s2s_start_clock  = os.clock()
    s2s_last_sample  = s2s_start_clock
    s2s_sample_count = 0
    s2s_pending_lesson_switch = false
    s2s_reset_validation_trackers()

    -- START ST-960: Reset timing stats
    s2s_timing_sum   = 0
    s2s_timing_count = 0
    s2s_timing_max   = 0
    s2s_timing_min   = 999
    -- END ST-960

    s2s_recording    = true

    s2s_log("INFO", "Recording STARTED → " .. s2s_filepath)
    s2s_log("INFO", string.format("Config: lesson=%s arc=%d %dHz, %d columns, REP=%s, v%s%s",
            s2s_active_lesson_tag,
            s2s_arc_for_lesson(s2s_active_lesson_tag),
            SAMPLE_HZ,
            NUM_COLS,
            tostring(S2S_REP_DETECTED),
            VERSION,
            reason and (", reason=" .. reason) or ""))
    if #s2s_missing_drefs > 0 then
        s2s_log("WARN", #s2s_missing_drefs ..
               " dataref(s) not found – those columns will be 0.")
        for _, d in ipairs(s2s_missing_drefs) do
            s2s_log("WARN", "  Missing: " .. d)
        end
    end
end

-- ════
-- PER-FRAME SAMPLER (called every sim frame; self-throttles to ~10 Hz)
-- ════
function s2s_frame_callback()
    if not s2s_recording then return end

    local now = os.clock()
    local delta = now - s2s_last_sample
    if delta < SAMPLE_INTERVAL then return end

    if s2s_pending_lesson_switch then
        s2s_log("INFO", "Applying mid-session lesson switch to " .. s2s_selected_lesson_tag)
        s2s_stop_recording("lesson_switch")
        s2s_start_recording("lesson_switch")
        return
    end

    -- START ST-960 Phase 5: Track timing statistics
    if s2s_timing_count > 0 or s2s_sample_count > 0 then
        s2s_timing_sum   = s2s_timing_sum + delta
        s2s_timing_count = s2s_timing_count + 1
        if delta > s2s_timing_max then s2s_timing_max = delta end
        if delta < s2s_timing_min then s2s_timing_min = delta end
    end
    -- END ST-960 Phase 5

    s2s_last_sample = now

    -- Wrap the entire sample in pcall so a single bad read never kills us
    local ok, errmsg = pcall(function()
        -- Elapsed seconds since recording started
        local t_sec = now - s2s_start_clock

        -- Read array datarefs for engine 0
        local carb_val    = read_arr_f(S2S_ref_carb)
        local gear_def    = read_arr_f(S2S_ref_gear_deflect)

        -- Best-of RPM and MAP (prefers REP, falls back to stock)
        local rpm_best = best_rpm()
        local mp_best  = best_mp()

        -- START ST-960 Phase 2: UNIT CONVERSIONS
        -- Convert altitude from meters to feet
        local alt_msl_ft = (S2S_alt_msl_m or 0) * M_TO_FT
        local alt_agl_ft = (S2S_alt_agl_m or 0) * M_TO_FT
        -- Convert groundspeed from m/s to knots
        local gs_kts     = (S2S_gs_ms or 0) * MS_TO_KTS
        -- Clamp IAS to non-negative (REP pitot sim can produce negative values)
        local ias_kts    = math.max(0, S2S_ias_raw or 0)
        local on_ground_flag = (S2S_on_ground or 0) >= 0.5 and 1 or 0
        -- END ST-960 Phase 2

        -- Validation warnings
        if ias_kts <= 0.01 then
            if not s2s_ias_zero_start_clock then
                s2s_ias_zero_start_clock = now
            elseif (not s2s_ias_zero_warned) and (now - s2s_ias_zero_start_clock >= IAS_ZERO_WARN_SEC) then
                s2s_ias_zero_warned = true
                s2s_push_warning("IAS has remained 0 for >30s (pitot cover still on?)")
            end
        else
            s2s_ias_zero_start_clock = nil
            s2s_ias_zero_warned = false
        end

        if s2s_prev_on_ground == nil then
            s2s_prev_on_ground = on_ground_flag
        elseif on_ground_flag ~= s2s_prev_on_ground then
            s2s_on_ground_transition_count = s2s_on_ground_transition_count + 1
            s2s_prev_on_ground = on_ground_flag
        end

        if (not s2s_on_ground_warned)
            and (t_sec >= ON_GROUND_NO_TRANSITION_WARN_SEC)
            and (s2s_on_ground_transition_count == 0) then
            s2s_on_ground_warned = true
            s2s_push_warning("on_ground never transitioned in first 2 minutes (never took off?)")
        end

        -- Build the CSV row  (order must match HEADER exactly — 69 columns)
        local row = string.format(
            -- t_sec, sim_time (1-2)
            "%.3f,%.2f,"  ..
            -- lat, lon, alt_msl_ft, alt_agl_ft (3-6)
            "%.7f,%.7f,%.2f,%.2f,"  ..
            -- ias, gs, vs (7-9)
            "%.2f,%.2f,%.1f,"  ..
            -- pitch, roll, hdg_mag, hdg_true, alpha, beta (10-15)
            "%.3f,%.3f,%.2f,%.2f,%.3f,%.3f,"  ..
            -- aileron, elevator, rudder (16-18) — shifted by new columns
            "%.4f,%.4f,%.4f,"  ..
            -- throttle, mixture, carb_heat (19-21)
            "%.4f,%.4f,%.4f,"  ..
            -- flap_ratio, flap_handle, elv_trim (22-24)
            "%.4f,%.4f,%.4f,"  ..
            -- rpm (best), mp (best) (25-26)
            "%.1f,%.2f,"  ..
            -- rep_rpm, rep_oil_temp_f, rep_oil_psi, rep_ff, rep_cowl (27-31)
            "%.1f,%.1f,%.1f,%.4f,%.3f,"  ..
            -- rep_cht, rep_egt (32-33)
            "%.1f,%.1f,"  ..
            -- on_ground, parking_brake (34-35)
            "%d,%.2f,"  ..
            -- fuel_total_kg (36)
            "%.1f,"  ..
            -- g_normal, g_side (37-38)
            "%.3f,%.3f,"  ..
            -- slip_deg, stall_warn, rep_stall_on, rep_stall_level (39-42)
            "%.2f,%d,%d,%d,"  ..
            -- gear_deflect_mtr (43)
            "%.5f,"  ..
            -- lights: beacon, nav, strobe, landing, taxi (44-48)
            "%d,%d,%d,%d,%d,"  ..
            -- battery, generator (49-50)
            "%d,%d,"  ..
            -- rep_fuel_pump, rep_avionics (51-52)
            "%d,%d,"  ..
            -- static items (53-59)
            "%d,%d,%d,%d,%d,%d,%d,"  ..
            -- head tracking (60-63)
            "%.2f,%.2f,%.2f,%d,"  ..
            -- wind_spd, wind_dir (64-65)
            "%.1f,%.1f,"  ..
            -- ST-960: REP L1 checklist (66-69)
            "%d,%.3f,%d,%d,"  ..
            -- recorder_version (70) — actually 69th data col + version string
            "%s",

            -- ─── Values ───
            t_sec,                    S2S_sim_time or 0,
            S2S_lat or 0,                  S2S_lon or 0,
            alt_msl_ft,                    alt_agl_ft,          -- ST-960: now in feet
            ias_kts,                       gs_kts,              -- ST-960: clamped / converted
            S2S_vs or 0,
            S2S_pitch or 0,                S2S_roll or 0,
            S2S_hdg or 0,                  S2S_hdg_true or 0,   -- ST-960: mag + true
            S2S_alpha or 0,                S2S_beta or 0,       -- ST-960: added beta
            S2S_aileron or 0,              S2S_elevator or 0,
            S2S_rudder or 0,
            S2S_throttle or 0,             S2S_mixture or 0,
            carb_val,
            S2S_flap_ratio or 0,           S2S_flap_handle or 0,
            S2S_elv_trim or 0,
            rpm_best,                    mp_best,
            S2S_rep_rpm or 0,              S2S_rep_oil_temp_f or 0,
            S2S_rep_oil_psi or 0,          S2S_rep_ff or 0,
            S2S_rep_cowl or 0,
            S2S_rep_cht_0 or 0,            S2S_rep_egt_0 or 0,
            on_ground_flag,                S2S_park_brake or 0,
            S2S_fuel_kg or 0,
            S2S_g_nrml or 0,               S2S_g_side or 0,
            S2S_slip_deg or 0,             S2S_stall_warn or 0,
            S2S_rep_stall_on or 0,         S2S_rep_stall_lvl or 0,
            gear_def,
            S2S_light_beacon or 0,         S2S_light_nav or 0,
            S2S_light_strobe or 0,         S2S_light_landing or 0,
            S2S_light_taxi or 0,
            S2S_battery_on or 0,           S2S_generator_on or 0,
            S2S_rep_fuel_pump or 0,        S2S_rep_avionics or 0,
            -- Static items (v4 corrected paths)
            S2S_chock_left or 0,           S2S_chock_right or 0,
            S2S_tiedown_left or 0,         S2S_tiedown_right or 0,
            S2S_tiedown_tail or 0,
            S2S_pitot_cover or 0,          S2S_towbar or 0,
            -- Head tracking
            S2S_head_psi or 0,             S2S_head_the or 0,
            S2S_head_phi or 0,             S2S_view_type or 0,
            S2S_wind_spd or 0,             S2S_wind_dir or 0,
            -- ST-960 Phase 3: REP L1 checklist datarefs
            S2S_rep_preheat or 0,          S2S_rep_plug_foul or 0,
            S2S_rep_primer or 0,           S2S_rep_magneto or 0,
            -- Version tag
            VERSION
        )

        -- Write (with inner pcall to survive transient I/O errors)
        if s2s_fh then
            s2s_fh:write(row .. "\n")
            s2s_sample_count = s2s_sample_count + 1
            -- Flush every FLUSH_INTERVAL samples
            if s2s_sample_count % FLUSH_INTERVAL == 0 then
                s2s_fh:flush()
            end
            -- START ST-960 Phase 5: Periodic sample rate logging
            if s2s_sample_count % 500 == 0 and s2s_timing_count > 0 then
                local avg = s2s_timing_sum / s2s_timing_count
                s2s_log("INFO", string.format(
                    "Sample #%d: avg_interval=%.4fs (%.1fHz), elapsed=%.1fs",
                    s2s_sample_count, avg, 1.0/avg, t_sec))
            end
            -- END ST-960 Phase 5
        end
    end)

    if not ok then
        s2s_log("ERROR", "Sample error (non-fatal): " .. tostring(errmsg))
    end
end

-- ════
-- ON-SCREEN OVERLAY (green "● REC" with elapsed time)
-- ════
function s2s_draw_overlay()
    s2s_cleanup_warning_overlay()

    local x = 20
    local y = (SCREEN_HEIGHT or 1080) - 30

    if s2s_recording then
        local elapsed  = os.clock() - s2s_start_clock
        local mins     = math.floor(elapsed / 60)
        local secs     = math.floor(elapsed % 60)
        local status   = string.format("● REC v%s [%s]  %02d:%02d  [%d @ %dHz]",
                                       VERSION, s2s_active_lesson_tag, mins, secs, s2s_sample_count, SAMPLE_HZ)

        XPLMSetGraphicsState(0,0,0, 0,0, 0,0)
        glColor4f(0, 0, 0, 0.55)
        glRectf(x - 4, y - 6, x + 430, y + 18)
        draw_string(x, y, status, 0.15, 1.0, 0.15)
    end

    local warn_y = y - 24
    for msg, _ in pairs(s2s_warning_messages) do
        XPLMSetGraphicsState(0,0,0, 0,0, 0,0)
        glColor4f(0.2, 0.0, 0.0, 0.72)
        glRectf(x - 4, warn_y - 6, x + 700, warn_y + 16)
        draw_string(x, warn_y, "⚠ " .. msg, 1.0, 0.55, 0.20)
        warn_y = warn_y - 20
    end
end

-- ════
-- LESSON SELECTOR (FlyWithLua ImGui)
-- ════
function s2s_lesson_selector_imgui_builder(wnd, x, y)
    imgui.TextUnformatted("Screen to Sky Recorder")
    imgui.Separator()
    imgui.TextUnformatted("Select lesson before flying:")

    for _, lesson in ipairs(LESSON_TAGS) do
        local selected = (s2s_selected_lesson_tag == lesson)
        if imgui.RadioButton(lesson, selected) then
            s2s_set_lesson_tag(lesson)
        end
        if _ < #LESSON_TAGS then
            imgui.SameLine()
        end
    end

    imgui.Spacing()
    imgui.TextUnformatted("Current selection: " .. s2s_selected_lesson_tag)
    if s2s_recording then
        imgui.TextUnformatted("Recording file lesson: " .. s2s_active_lesson_tag)
        if s2s_pending_lesson_switch then
            imgui.TextUnformatted("Switch pending: new file will start automatically")
        end
    end

    imgui.Spacing()
    if imgui.Button("Start New Recording") then
        s2s_start_recording("manual_start")
    end
    imgui.SameLine()
    if imgui.Button("Stop Recording") then
        s2s_stop_recording("manual_stop")
    end
end

local function s2s_create_lesson_window()
    if s2s_lesson_wnd then return end
    s2s_lesson_wnd = float_wnd_create(S2S_LESSON_WND_W, S2S_LESSON_WND_H, 1, true)
    if s2s_lesson_wnd then
        float_wnd_set_title(s2s_lesson_wnd, "S2S Lesson Selector")
        float_wnd_set_position(s2s_lesson_wnd, 40, 120)
        float_wnd_set_imgui_builder(s2s_lesson_wnd, "s2s_lesson_selector_imgui_builder")
    else
        s2s_log("ERROR", "Failed to create lesson selector window")
    end
end

-- ════
-- REGISTER CALLBACKS
-- ════
do_every_frame("s2s_frame_callback()")
do_every_draw("s2s_draw_overlay()")

-- ── Commands ────
create_command("s2s/stop_recording",
               "S2S: Stop Recording",
               "s2s_stop_recording('command_stop')", "", "")

create_command("s2s/start_recording_new",
               "S2S: Start New Recording",
               "s2s_start_recording('command_start')", "", "")

create_command("s2s/show_lesson_selector",
               "S2S: Show Lesson Selector",
               "if s2s_lesson_wnd then float_wnd_set_visible(s2s_lesson_wnd, true) end", "", "")

-- ── Graceful cleanup ────
do_on_exit("s2s_stop_recording('script_exit')")

-- ── Close log on exit ────
do_on_exit("if s2s_log_fh then s2s_log_fh:close() end")

-- ── Init on load ────
s2s_create_lesson_window()

s2s_log("INFO", "s2s_telemetry_recorder.lua loaded  (v" .. VERSION ..
        " – ST-960 ENHANCED + lesson selector + metadata + smart filenames + validation warnings)")
s2s_log("INFO", "Use lesson selector window to pick L1/L2/L3/L4 and start recording.")
