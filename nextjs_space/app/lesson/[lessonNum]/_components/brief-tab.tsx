// Updated ST-805B PR3 — Trigger thresholds section
'use client';

import { motion } from 'framer-motion';
import { Target, MapPin, BookOpen, Info, Crosshair } from 'lucide-react';
import { L2Doctrine } from './l2-doctrine';

interface BriefTabProps {
  lesson: any;
}

// START ST-805B PR3 — Parse trigger thresholds string into items
function parseTriggerThresholds(raw: string | null | undefined): { name: string; description: string }[] {
  if (!raw) return [];
  return raw.split(';').map((item) => {
    const trimmed = item.trim();
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) return { name: trimmed, description: trimmed };
    const name = trimmed.slice(0, colonIdx).trim();
    const description = trimmed.slice(colonIdx + 1).trim();
    return { name: formatThresholdName(name), description };
  }).filter((item) => item.description.length > 0);
}

function formatThresholdName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
// END ST-805B PR3

export function BriefTab({ lesson }: BriefTabProps) {
  const objectives = (lesson?.objectives as string[]) ?? [];
  const hasTodoObjectives = objectives?.length === 1 && objectives?.[0]?.includes?.('TODO');

  // START ST-805B PR3 — Trigger thresholds from lesson data
  const triggerThresholds = parseTriggerThresholds(lesson?.triggerThresholds);
  // END ST-805B PR3

  return (
    <div className="space-y-6">
      {/* Description */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-5 rounded-xl bg-card/30 border border-border/30"
      >
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-[#60B5FF]" />
          <h3 className="text-sm font-semibold text-white">Overview</h3>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {lesson?.description ?? 'No description available.'}
        </p>
      </motion.div>

      {/* Objectives */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="p-5 rounded-xl bg-card/30 border border-border/30"
      >
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Objectives</h3>
        </div>
        {hasTodoObjectives ? (
          <p className="text-sm text-muted-foreground italic">Objectives pending curriculum specialist review.</p>
        ) : (
          <ul className="space-y-2">
            {(objectives ?? []).map((obj: string, idx: number) => (
              <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                {obj}
              </li>
            ))}
          </ul>
        )}
      </motion.div>

      {/* START ST-805B PR3 — Trigger Thresholds (what gets scored) */}
      {triggerThresholds.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20"
        >
          <div className="flex items-center gap-2 mb-3">
            <Crosshair className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">What Gets Scored</h3>
          </div>
          <p className="text-[11px] text-muted-foreground mb-3">
            These are the items the scoring engine evaluates during your flight.
          </p>
          <ul className="space-y-2">
            {triggerThresholds.map((threshold, idx) => (
              <li key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/5">
                <span className="w-5 h-5 rounded bg-amber-500/10 text-amber-400 text-[10px] font-mono flex items-center justify-center flex-shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">{threshold.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{threshold.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </motion.div>
      )}
      {/* END ST-805B PR3 */}

      {/* Brief Content */}
      {lesson?.briefContent && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="p-5 rounded-xl bg-card/30 border border-border/30"
        >
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Instructor Brief</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
            {lesson?.briefContent}
          </p>
        </motion.div>
      )}

      {/* START ST-802D Logic - L2 Doctrine Display */}
      {lesson?.lessonNum === 2 && <L2Doctrine />}
      {/* END ST-802D Logic */}

      {/* Hub Location */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="p-4 rounded-xl bg-card/30 border border-border/30"
      >
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-[#FF9149]" />
          <span className="text-xs text-muted-foreground">Hub Location:</span>
          <span className="text-xs font-mono text-white">{lesson?.hubLocation ?? 'KHMP'}</span>
          <span className="text-xs text-muted-foreground">· 882 ft MSL · Pattern: 1,882 ft MSL</span>
        </div>
      </motion.div>
    </div>
  );
}
