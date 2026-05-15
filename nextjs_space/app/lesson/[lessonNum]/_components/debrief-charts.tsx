// Updated ST-805B PR3 — Slip/ball chart for coordination visualization
'use client';

import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
  ScatterChart, Scatter, ReferenceLine, ReferenceArea,
} from 'recharts';
import { C172_CONSTANTS, KHMP_CONSTANTS } from '@/types/telemetry';

interface DebriefChartsProps {
  rows: any[];
  segments: any[];
  summary: any;
  lessonNum?: number;
}

export default function DebriefCharts({ rows, segments, summary, lessonNum }: DebriefChartsProps) {
  const altitudeData = useMemo(() => {
    return (rows ?? []).map((r: any, i: number) => ({
      time: Math.round((r?.t_sec ?? 0) * 10) / 10,
      altMsl: Math.round(r?.alt_msl ?? 0),
      altAgl: Math.round(r?.alt_agl ?? 0),
    }));
  }, [rows]);

  const speedData = useMemo(() => {
    return (rows ?? []).map((r: any) => ({
      time: Math.round((r?.t_sec ?? 0) * 10) / 10,
      ias: Math.round((r?.ias_kts ?? 0) * 10) / 10,
      gs: Math.round((r?.gs_kts ?? 0) * 10) / 10,
    }));
  }, [rows]);

  const flightPathData = useMemo(() => {
    return (rows ?? []).filter((r: any) => (r?.lat ?? 0) !== 0 && (r?.lon ?? 0) !== 0).map((r: any) => ({
      lon: r?.lon ?? 0,
      lat: r?.lat ?? 0,
    }));
  }, [rows]);

  const controlsData = useMemo(() => {
    return (rows ?? []).map((r: any) => ({
      time: Math.round((r?.t_sec ?? 0) * 10) / 10,
      aileron: Math.round((r?.aileron ?? 0) * 100) / 100,
      elevator: Math.round((r?.elevator ?? 0) * 100) / 100,
      rudder: Math.round((r?.rudder ?? 0) * 100) / 100,
    }));
  }, [rows]);

  // START ST-805B PR3 — Slip/Ball data for coordination chart (L2-L4)
  const showSlipChart = (lessonNum ?? 0) >= 2;
  const slipData = useMemo(() => {
    if (!showSlipChart) return [];
    return (rows ?? [])
      .filter((r: any) => {
        // Show slip data when airborne (on_ground === 0 or on_gnd === 0)
        const onGround = r?.on_ground ?? r?.on_gnd ?? 1;
        return onGround === 0 || onGround === false;
      })
      .map((r: any) => ({
        time: Math.round((r?.t_sec ?? 0) * 10) / 10,
        slip: Math.round((r?.slip_deg ?? r?.slip ?? 0) * 100) / 100,
        vs: Math.round(r?.vs_fpm ?? r?.vs ?? 0),
        ias: Math.round(r?.ias_kts ?? r?.ias ?? 0),
      }));
  }, [rows, showSlipChart]);

  // Determine tolerance based on lesson
  const climbTolerance = 3.0;
  const slowFlightTolerance = 4.0;
  const displayTolerance = (lessonNum ?? 0) === 3 ? slowFlightTolerance : climbTolerance;
  // END ST-805B PR3

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Max Alt MSL" value={`${summary?.maxAltMsl ?? 0} ft`} />
        <StatCard label="Max IAS" value={`${summary?.maxIas ?? 0} kts`} />
        <StatCard label="Landings" value={`${summary?.landingCount ?? 0}`} />
        <StatCard label="T&Gs" value={`${summary?.touchAndGoCount ?? 0}`} />
      </div>

      {/* Flight Path 2D */}
      {(flightPathData?.length ?? 0) > 5 && (
        <ChartCard title="Flight Path (2D)">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 10, bottom: 25, left: 10 }}>
              <XAxis
                dataKey="lon"
                type="number"
                domain={['auto', 'auto']}
                tickLine={false}
                tick={{ fontSize: 10 }}
                label={{ value: 'Longitude', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <YAxis
                dataKey="lat"
                type="number"
                domain={['auto', 'auto']}
                tickLine={false}
                tick={{ fontSize: 10 }}
                label={{ value: 'Latitude', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Scatter data={flightPathData} fill="#60B5FF" r={1} />
            </ScatterChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Altitude Profile */}
      {(altitudeData?.length ?? 0) > 2 && (
        <ChartCard title="Altitude Profile">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={altitudeData} margin={{ top: 10, right: 10, bottom: 25, left: 15 }}>
              <XAxis
                dataKey="time"
                tickLine={false}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                label={{ value: 'Time (s)', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <YAxis
                tickLine={false}
                tick={{ fontSize: 10 }}
                label={{ value: 'Altitude (ft)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={KHMP_CONSTANTS.patternAltitude} stroke="#FF914980" strokeDasharray="3 3" label={{ value: 'Pattern', fontSize: 9, fill: '#FF9149' }} />
              <Line type="monotone" dataKey="altMsl" name="MSL" stroke="#60B5FF" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="altAgl" name="AGL" stroke="#80D8C3" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Speed Profile */}
      {(speedData?.length ?? 0) > 2 && (
        <ChartCard title="Airspeed Profile">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={speedData} margin={{ top: 10, right: 10, bottom: 25, left: 15 }}>
              <XAxis
                dataKey="time"
                tickLine={false}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                label={{ value: 'Time (s)', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <YAxis
                tickLine={false}
                tick={{ fontSize: 10 }}
                label={{ value: 'Speed (kts)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={C172_CONSTANTS.Vr} stroke="#FF636380" strokeDasharray="3 3" label={{ value: 'Vr', fontSize: 9, fill: '#FF6363' }} />
              <ReferenceLine y={C172_CONSTANTS.Vy} stroke="#80D8C380" strokeDasharray="3 3" label={{ value: 'Vy', fontSize: 9, fill: '#80D8C3' }} />
              <ReferenceLine y={C172_CONSTANTS.Vapproach} stroke="#FF914980" strokeDasharray="3 3" label={{ value: 'Vapp', fontSize: 9, fill: '#FF9149' }} />
              <Line type="monotone" dataKey="ias" name="IAS" stroke="#60B5FF" dot={false} strokeWidth={1.5} />
              <Line type="monotone" dataKey="gs" name="GS" stroke="#A19AD3" dot={false} strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* Controls */}
      {(controlsData?.length ?? 0) > 2 && (
        <ChartCard title="Control Inputs">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={controlsData} margin={{ top: 10, right: 10, bottom: 25, left: 15 }}>
              <XAxis
                dataKey="time"
                tickLine={false}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                label={{ value: 'Time (s)', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <YAxis
                tickLine={false}
                tick={{ fontSize: 10 }}
                domain={[-1, 1]}
                label={{ value: 'Deflection', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="aileron" name="Aileron" stroke="#60B5FF" dot={false} strokeWidth={1} />
              <Line type="monotone" dataKey="elevator" name="Elevator" stroke="#FF9149" dot={false} strokeWidth={1} />
              <Line type="monotone" dataKey="rudder" name="Rudder" stroke="#80D8C3" dot={false} strokeWidth={1} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {/* START ST-805B PR3 — Slip/Ball Coordination Chart */}
      {showSlipChart && (slipData?.length ?? 0) > 5 && (
        <ChartCard title="Coordination — Slip/Skid Ball (Airborne)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={slipData} margin={{ top: 10, right: 10, bottom: 25, left: 15 }}>
              <XAxis
                dataKey="time"
                tickLine={false}
                tick={{ fontSize: 10 }}
                interval="preserveStartEnd"
                label={{ value: 'Time (s)', position: 'insideBottom', offset: -15, style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <YAxis
                tickLine={false}
                tick={{ fontSize: 10 }}
                domain={[-8, 8]}
                label={{ value: 'Slip (°)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: 11 } }}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                formatter={(value: any, name: string) => {
                  if (name === 'Slip') return [`${value}°`, 'Slip'];
                  return [value, name];
                }}
              />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11 }} />
              {/* Tolerance zone — ±3° for climb, ±4° for slow flight */}
              <ReferenceArea y1={-climbTolerance} y2={climbTolerance} fill="#80D8C3" fillOpacity={0.08} label={{ value: `±${climbTolerance}°`, fontSize: 9, fill: '#80D8C3', position: 'right' }} />
              {(lessonNum ?? 0) === 3 && (
                <ReferenceArea y1={-slowFlightTolerance} y2={slowFlightTolerance} fill="#A19AD3" fillOpacity={0.05} label={{ value: `±${slowFlightTolerance}°`, fontSize: 9, fill: '#A19AD3', position: 'right' }} />
              )}
              <ReferenceLine y={0} stroke="#80D8C380" strokeDasharray="3 3" label={{ value: 'Centered', fontSize: 9, fill: '#80D8C3' }} />
              <Line type="monotone" dataKey="slip" name="Slip" stroke="#FF9149" dot={false} strokeWidth={1.5} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
      {/* END ST-805B PR3 */}

      {/* Segments timeline */}
      {(segments?.length ?? 0) > 0 && (
        <div className="p-5 rounded-xl bg-card/30 border border-border/30">
          <h4 className="text-sm font-semibold text-white mb-3">Flight Segments</h4>
          <div className="space-y-1">
            {(segments ?? []).map((seg: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <span className="w-16 text-right font-mono text-muted-foreground">
                  {Math.round(seg?.startTime ?? 0)}s
                </span>
                <div className={`h-1.5 rounded-full flex-1 ${
                  getSegmentColor(seg?.type)
                }`} style={{ maxWidth: `${Math.max(2, ((seg?.endTime ?? 0) - (seg?.startTime ?? 0)) / 2)}%` }} />
                <span className="w-24 font-mono text-muted-foreground">
                  {seg?.type ?? 'UNKNOWN'}
                </span>
                <span className={`text-[10px] px-1 rounded ${
                  seg?.confidence === 'HIGH' ? 'text-emerald-400' :
                  seg?.confidence === 'MEDIUM' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {seg?.confidence ?? 'N/A'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl bg-card/30 border border-border/30">
      <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>
      <div className="h-56">
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/10 text-center">
      <p className="text-lg font-mono font-bold text-white">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function getSegmentColor(type: string): string {
  switch (type) {
    case 'PREFLIGHT': return 'bg-gray-400';
    case 'TAXI': return 'bg-amber-400';
    case 'TAKEOFF_ROLL': return 'bg-orange-400';
    case 'LIFTOFF': return 'bg-red-400';
    case 'CLIMB': return 'bg-emerald-400';
    case 'DOWNWIND': return 'bg-blue-400';
    case 'APPROACH': return 'bg-purple-400';
    case 'LANDING': return 'bg-cyan-400';
    case 'TOUCH_AND_GO': return 'bg-pink-400';
    case 'FULL_STOP': return 'bg-indigo-400';
    default: return 'bg-muted-foreground';
  }
}
