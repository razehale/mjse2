// START ST-802C Logic — Ground School Tab Component
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, Target, MapPin, AlertCircle, Clock, CheckCircle, Plane, Info } from 'lucide-react';

interface GroundSchoolTabProps {
  lesson: any;
}

export function GroundSchoolTab({ lesson }: GroundSchoolTabProps) {
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (lesson?.lessonNum) {
      fetchContent(lesson.lessonNum);
    }
  }, [lesson?.lessonNum]);

  const fetchContent = async (lessonNum: number) => {
    try {
      const res = await fetch(`/api/ground-school/${lessonNum}`);
      if (res?.ok) {
        setContent(await res.json());
      } else {
        setError('Ground school content not available for this lesson yet.');
      }
    } catch (err: any) {
      setError('Failed to load ground school content.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-[#60B5FF] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">{error || 'No ground school content available.'}</p>
      </div>
    );
  }

  const targetNumbers = content?.targetNumbers ?? {};
  const beforeYouFly: string[] = content?.beforeYouFly ?? [];
  const mission: string[] = content?.mission ?? [];
  const whatMattersToday: string[] = content?.whatMattersToday ?? [];
  const simpleFlightFlow: string[] = content?.simpleFlightFlow ?? [];
  const commonMistakes: string[] = content?.commonMistakes ?? [];
  const doNotWorryAboutYet: string[] = content?.doNotWorryAboutYet ?? [];
  // START ST-963 Logic — CFI Notes
  const cfiNotes: string = content?.cfiNotes ?? '';
  // END ST-963 Logic

  return (
    <div className="space-y-6">
      {/* Header Meta */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 text-xs text-muted-foreground"
      >
        {content?.estimatedReadTimeMin && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {content.estimatedReadTimeMin} min read
          </span>
        )}
        {content?.studentLevel && (
          <span className="px-2 py-0.5 rounded bg-[#60B5FF]/10 text-[#60B5FF] font-mono text-[10px]">
            {content.studentLevel}
          </span>
        )}
        {content?.mode && (
          <span className="px-2 py-0.5 rounded bg-muted/20 font-mono text-[10px]">
            {content.mode}
          </span>
        )}
      </motion.div>

      {/* Before You Fly */}
      {beforeYouFly.length > 0 && (
        <Section
          title="Before You Fly"
          icon={<Info className="w-4 h-4 text-sky-400" />}
          items={beforeYouFly}
          delay={0}
          style="info"
        />
      )}

      {/* Mission */}
      {mission.length > 0 && (
        <Section
          title="Today's Mission"
          icon={<Plane className="w-4 h-4 text-[#60B5FF]" />}
          items={mission}
          delay={0.05}
          style="numbered"
        />
      )}

      {/* What Matters Today */}
      {whatMattersToday.length > 0 && (
        <Section
          title="What Matters Today"
          icon={<Target className="w-4 h-4 text-emerald-400" />}
          items={whatMattersToday}
          delay={0.1}
          style="check"
        />
      )}

      {/* Target Numbers */}
      {Object.keys(targetNumbers).length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="p-5 rounded-xl bg-card/30 border border-border/30"
        >
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Target Numbers</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(targetNumbers).map(([key, val]: [string, any]) => {
              const label = formatTargetLabel(key);
              return (
                <div key={key} className="p-3 rounded-lg bg-muted/10 text-center">
                  <p className="text-lg font-mono font-bold text-white">
                    {typeof val === 'number' ? val : String(val ?? '')}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Simple Flight Flow */}
      {simpleFlightFlow.length > 0 && (
        <Section
          title="Simple Flight Flow"
          icon={<Plane className="w-4 h-4 text-[#60B5FF]" />}
          items={simpleFlightFlow}
          delay={0.2}
          style="numbered"
        />
      )}

      {/* Common Mistakes */}
      {commonMistakes.length > 0 && (
        <Section
          title="Common Mistakes"
          icon={<AlertCircle className="w-4 h-4 text-red-400" />}
          items={commonMistakes}
          delay={0.25}
          style="warning"
        />
      )}

      {/* Don't Worry About Yet */}
      {doNotWorryAboutYet.length > 0 && (
        <Section
          title="Don't Worry About Yet"
          icon={<Info className="w-4 h-4 text-muted-foreground" />}
          items={doNotWorryAboutYet}
          delay={0.3}
          style="muted"
        />
      )}

      {/* START ST-963 Logic — CFI Notes (conditional, only if non-empty) */}
      {cfiNotes && cfiNotes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="p-5 rounded-xl bg-purple-500/5 border border-purple-500/20"
        >
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-purple-300">CFI Notes</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{cfiNotes}</p>
        </motion.div>
      )}
      {/* END ST-963 Logic */}
    </div>
  );
}

// --- Helper components ---

function Section({
  title,
  icon,
  items,
  delay,
  style,
}: {
  title: string;
  icon: React.ReactNode;
  items: string[];
  delay: number;
  style: 'info' | 'numbered' | 'check' | 'warning' | 'muted';
}) {
  const borderClass = {
    info: 'border-sky-500/20',
    numbered: 'border-[#60B5FF]/20',
    check: 'border-emerald-500/20',
    warning: 'border-red-500/20',
    muted: 'border-border/30',
  }[style];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={`p-5 rounded-xl bg-card/30 border ${borderClass}`}
    >
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="flex-shrink-0 mt-0.5">
              {style === 'numbered' ? (
                <span className="text-[10px] font-mono text-muted-foreground w-4 inline-block text-right mr-1">{i + 1}.</span>
              ) : style === 'check' ? (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              ) : style === 'warning' ? (
                <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              ) : (
                <span className="text-muted-foreground text-xs">▸</span>
              )}
            </span>
            <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

function formatTargetLabel(key: string): string {
  const map: Record<string, string> = {
    runway: 'Runway',
    runwayHeading: 'Rwy Heading',
    oppositeHeading: 'Opposite Heading',
    fieldElevationMsl: 'Field Elev (MSL)',
    patternAltitudeMsl: 'Pattern Alt (MSL)',
    vrKias: 'Vr',
    vyKias: 'Vy',
    approachKias: 'Approach',
    downwindKias: 'Downwind',
    bestGlideKias: 'Best Glide',
    vsoKias: 'Vso (Stall Dirty)',
    vsKias: 'Vs (Stall Clean)',
    vfeKias: 'Vfe (Max Flaps)',
    steepTurnBank: 'Steep Turn Bank',
  };
  return map[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/Kias$/, '').trim();
}
// END ST-802C Logic
