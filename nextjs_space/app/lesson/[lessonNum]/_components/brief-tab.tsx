'use client';

import { motion } from 'framer-motion';
import { Target, MapPin, BookOpen, Info } from 'lucide-react';
import { L2Doctrine } from './l2-doctrine';

interface BriefTabProps {
  lesson: any;
}

export function BriefTab({ lesson }: BriefTabProps) {
  const objectives = (lesson?.objectives as string[]) ?? [];
  const hasTodoObjectives = objectives?.length === 1 && objectives?.[0]?.includes?.('TODO');

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
