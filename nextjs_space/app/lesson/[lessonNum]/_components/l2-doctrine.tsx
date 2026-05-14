'use client';

// START ST-802D Logic - L2 Doctrine Display
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Zap, Plane, Wind, TrendingUp, RotateCcw, AlertTriangle, BookOpen, Loader2 } from 'lucide-react';

const ICONS: Record<string, any> = {
  POWER: Zap,
  PITCH: Plane,
  CLEAN: Wind,
  CLIMB: TrendingUp,
  REJOIN: RotateCcw,
};

const COLORS: Record<string, string> = {
  POWER: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  PITCH: 'text-[#60B5FF] bg-[#60B5FF]/10 border-[#60B5FF]/30',
  CLEAN: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  CLIMB: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  REJOIN: 'text-[#FF9149] bg-[#FF9149]/10 border-[#FF9149]/30',
};

export function L2Doctrine() {
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/l2-doctrine')
      .then((r) => r.json())
      .then((d) => {
        setDoc(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-5 rounded-xl bg-card/30 border border-border/30 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-[#60B5FF]" />
        <span className="text-xs text-muted-foreground">Loading doctrine...</span>
      </div>
    );
  }
  if (!doc) return null;

  const mm = doc?.mental_model ?? {};
  const phrase: string = mm?.phrase ?? '';
  const breakdown: Record<string, any> = mm?.breakdown ?? {};
  const triggers: any[] = doc?.when_to_go_around ?? doc?.triggers ?? [];
  const callout: string = doc?.callout ?? doc?.standard_callout ?? '';
  const errors: any[] = doc?.common_errors ?? doc?.errors ?? [];

  return (
    <>
      {/* Mental Model */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="p-5 rounded-xl bg-card/30 border border-border/30"
      >
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-[#60B5FF]" />
          <h3 className="text-sm font-semibold text-white">Mental Model: Go-Around</h3>
        </div>
        {phrase && (
          <p className="text-base font-mono font-bold text-white tracking-wider mb-4">{phrase}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {Object.entries(breakdown).map(([key, val]: [string, any], i) => {
            const Icon = ICONS[key.toUpperCase()] ?? Zap;
            const colorCls = COLORS[key.toUpperCase()] ?? 'text-white bg-card/50 border-border/30';
            return (
              <div key={i} className={`p-3 rounded-lg border ${colorCls}`}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-xs font-bold uppercase tracking-wider">{key}</span>
                </div>
                <p className="text-[11px] text-white/90 leading-snug">
                  {val?.action ?? val?.description ?? (typeof val === 'string' ? val : '')}
                </p>
                {val?.detail && (
                  <p className="text-[10px] text-muted-foreground mt-1 leading-snug">{val.detail}</p>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Triggers */}
      {triggers?.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-xl bg-card/30 border border-border/30"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">When to Go Around</h3>
          </div>
          <ul className="space-y-1.5">
            {triggers.map((t: any, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <span>{typeof t === 'string' ? t : t?.trigger ?? t?.description ?? JSON.stringify(t)}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      {/* Callout */}
      {callout && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="p-4 rounded-xl bg-[#60B5FF]/10 border border-[#60B5FF]/30"
        >
          <p className="text-xs text-[#60B5FF] uppercase tracking-wider font-semibold mb-1">Standard Callout</p>
          <p className="text-sm font-mono text-white">“{callout}”</p>
        </motion.div>
      )}

      {/* Common Errors */}
      {errors?.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="p-5 rounded-xl bg-card/30 border border-border/30"
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h3 className="text-sm font-semibold text-white">Common Errors</h3>
          </div>
          <ul className="space-y-1.5">
            {errors.map((e: any, i: number) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 flex-shrink-0" />
                <span>{typeof e === 'string' ? e : e?.error ?? e?.description ?? JSON.stringify(e)}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </>
  );
}
// END ST-802D Logic
