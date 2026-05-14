// START ST-802D Logic — GLGL Tracker Component
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Plane, RotateCcw } from 'lucide-react';

interface GLGLEvent {
  type: 'go_around' | 'landing';
  label: string;
  detected: boolean;
  timestamp_t: number | null;
  score: number;
  grade: string;
  alt_agl_at_decision?: number;
  decision_appropriate?: boolean;
  breakdown?: {
    power: { score: number; grade: string; detail: string };
    pitch: { score: number; grade: string; detail: string };
    flap: { score: number; grade: string; detail: string };
    climb: { score: number; grade: string; detail: string };
  };
  failure_conditions?: string[];
  safety_failed?: boolean;
  coaching?: string[];
  touchdown_hdg?: number;
  touchdown_ias?: number;
}

interface GLGLData {
  required_sequence: string[];
  events: GLGLEvent[];
  counts: { go_arounds_detected: number; landings_detected: number; events_at_least_4: number };
  pass_conditions: {
    two_go_arounds: boolean;
    two_landings: boolean;
    at_least_2_events_score_4: boolean;
    no_safety_failures: boolean;
  };
  safety_banner: boolean;
}

function stateClasses(ev: GLGLEvent): { bg: string; border: string; text: string; icon: string } {
  if (!ev.detected) return { bg: 'bg-muted/20', border: 'border-muted/30', text: 'text-muted-foreground', icon: 'text-muted-foreground' };
  if (ev.safety_failed) return { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', icon: 'text-red-400' };
  if (ev.score >= 4) return { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300', icon: 'text-emerald-400' };
  if (ev.score >= 3) return { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-300', icon: 'text-sky-400' };
  return { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300', icon: 'text-amber-400' };
}

export function GLGLTracker({ data }: { data: GLGLData }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const events = data?.events ?? [];

  return (
    <div className="space-y-3">
      {/* Safety banner */}
      {data?.safety_banner && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-red-300">Safety Failure Detected</p>
            <p className="text-[10px] text-red-400/80">One or more go-arounds hit a safety failure condition (stall, sink, IAS decay, instant flap snap, or unsafe altitude). Review the event details below.</p>
          </div>
        </motion.div>
      )}

      {/* GLGL header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-[#60B5FF]" />
            GLGL Sequence
          </h3>
          <p className="text-[10px] text-muted-foreground">Go-Around → Landing → Go-Around → Landing</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">Detected</p>
          <p className="text-xs font-mono text-white">{data?.counts?.go_arounds_detected ?? 0} GA · {data?.counts?.landings_detected ?? 0} L</p>
        </div>
      </div>

      {/* 4 event blocks */}
      <div className="grid grid-cols-4 gap-2">
        {events.map((ev: GLGLEvent, i: number) => {
          const cls = stateClasses(ev);
          const isOpen = expandedIdx === i;
          return (
            <button
              key={i}
              onClick={() => setExpandedIdx(isOpen ? null : i)}
              className={`p-3 rounded-lg border ${cls.bg} ${cls.border} text-center transition-all hover:opacity-90`}
            >
              <div className={`flex items-center justify-center mb-1 ${cls.icon}`}>
                {ev.type === 'go_around' ? <RotateCcw className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
              </div>
              <p className={`text-xs font-bold ${cls.text}`}>{ev.label}</p>
              <p className={`text-[10px] mt-0.5 ${cls.text}`}>{ev.detected ? `${ev.score}/5` : 'Missing'}</p>
              {ev.detected && <p className={`text-[9px] ${cls.text} opacity-75`}>{ev.grade}</p>}
            </button>
          );
        })}
      </div>

      {/* Expanded event details */}
      <AnimatePresence>
        {expandedIdx != null && events[expandedIdx] && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <EventDetail ev={events[expandedIdx]} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pass conditions checklist */}
      <div className="p-3 rounded-lg bg-card/30 border border-border/30 space-y-1">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">L2 Pass Conditions</p>
        <PassRow label="2 Go-Arounds detected" ok={data?.pass_conditions?.two_go_arounds} />
        <PassRow label="2 Landings detected" ok={data?.pass_conditions?.two_landings} />
        <PassRow label="At least 2 of 4 events scored ≥ 4" ok={data?.pass_conditions?.at_least_2_events_score_4} />
        <PassRow label="No safety failures" ok={data?.pass_conditions?.no_safety_failures} />
      </div>
    </div>
  );
}

function PassRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {ok ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> : <XCircle className="w-3.5 h-3.5 text-red-400" />}
      <span className={ok ? 'text-emerald-300' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

function EventDetail({ ev }: { ev: GLGLEvent }) {
  if (!ev.detected) {
    return (
      <div className="p-4 rounded-lg bg-muted/10 border border-muted/30 text-center text-xs text-muted-foreground">
        {ev.label} was not detected in this telemetry. {ev.type === 'go_around' ? 'Add a go-around to the pattern.' : 'Land the airplane to complete this slot.'}
      </div>
    );
  }
  const cls = stateClasses(ev);
  return (
    <div className={`p-4 rounded-lg border ${cls.border} ${cls.bg} space-y-3`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-semibold ${cls.text}`}>{ev.label} — {ev.type === 'go_around' ? 'Go-Around' : 'Landing'}</p>
          {ev.timestamp_t != null && <p className="text-[10px] text-muted-foreground">t = {ev.timestamp_t.toFixed(1)}s</p>}
        </div>
        <div className="text-right">
          <p className={`text-2xl font-mono font-bold ${cls.text}`}>{ev.score}<span className="text-sm text-muted-foreground">/5</span></p>
          <p className={`text-[10px] font-semibold ${cls.text}`}>{ev.grade}</p>
        </div>
      </div>

      {ev.type === 'go_around' && (
        <>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2 rounded bg-muted/5">
              <p className="text-muted-foreground">AGL at decision</p>
              <p className="text-white font-mono">{ev.alt_agl_at_decision?.toFixed(0) ?? '-'} ft</p>
            </div>
            <div className="p-2 rounded bg-muted/5">
              <p className="text-muted-foreground">Decision</p>
              <p className={ev.decision_appropriate ? 'text-emerald-400' : 'text-amber-400'}>
                {ev.decision_appropriate ? 'Appropriate (unstable approach)' : 'Stable approach — verify intent'}
              </p>
            </div>
          </div>

          {ev.breakdown && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Breakdown</p>
              {[
                { name: 'Power', val: ev.breakdown.power },
                { name: 'Pitch', val: ev.breakdown.pitch },
                { name: 'Flap', val: ev.breakdown.flap },
                { name: 'Climb', val: ev.breakdown.climb },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded bg-muted/5 text-[11px]">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold">{row.name}</p>
                    <p className="text-muted-foreground truncate">{row.val.detail}</p>
                  </div>
                  <span className="text-xs font-mono font-bold text-white ml-2">{row.val.score}/5</span>
                </div>
              ))}
            </div>
          )}

          {(ev.failure_conditions?.length ?? 0) > 0 && (
            <div className="p-2 rounded bg-red-500/10 border border-red-500/30 space-y-1">
              <p className="text-[10px] font-bold text-red-300 uppercase tracking-wide">🚨 Failure Conditions</p>
              {ev.failure_conditions!.map((f, i) => (
                <p key={i} className="text-[11px] text-red-300">• {f}</p>
              ))}
            </div>
          )}

          {(ev.coaching?.length ?? 0) > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Coaching</p>
              <ul className="space-y-1">
                {ev.coaching!.map((c, i) => (
                  <li key={i} className="text-[11px] text-muted-foreground flex gap-1"><span className="text-[#60B5FF]">▸</span><span>{c}</span></li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {ev.type === 'landing' && (
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded bg-muted/5">
            <p className="text-muted-foreground">Touchdown HDG</p>
            <p className="text-white font-mono">{ev.touchdown_hdg?.toFixed(0) ?? '-'}°</p>
          </div>
          <div className="p-2 rounded bg-muted/5">
            <p className="text-muted-foreground">Touchdown IAS</p>
            <p className="text-white font-mono">{ev.touchdown_ias?.toFixed(0) ?? '-'} KIAS</p>
          </div>
        </div>
      )}
    </div>
  );
}
// END ST-802D Logic
