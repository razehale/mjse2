// Updated ST-805B PR3 — Structured debrief rendering
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3, MessageSquare, Eye, CheckCircle, AlertTriangle, Shield, FileText,
  ChevronDown, ChevronUp, Lightbulb, ThumbsUp, Wrench, Compass, ArrowRight, Brain,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
// START ST-802D Logic
import { GLGLTracker } from './glgl-tracker';
// END ST-802D Logic

const DebriefCharts: any = dynamic(() => import('./debrief-charts') as any, {
  ssr: false,
  loading: () => <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">Loading charts...</div>,
});

interface DebriefTabProps {
  lesson: any;
  sessions: any[];
  lessonId: string;
  onDebriefViewed: () => void;
}

// START ST-805B PR3 — Debrief content type + parser
interface StructuredDebrief {
  summary: string;
  what_you_did_well: string[];
  what_to_fix: string[];
  coach_callouts: string[];
  next_focus: string;
}

function parseDebriefContent(raw: any): StructuredDebrief | null {
  if (!raw) return null;
  // If it's a string, try to parse as JSON
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return null; }
  }
  // Validate shape
  if (parsed && typeof parsed === 'object' && typeof parsed.summary === 'string') {
    return {
      summary: parsed.summary ?? '',
      what_you_did_well: Array.isArray(parsed.what_you_did_well) ? parsed.what_you_did_well : [],
      what_to_fix: Array.isArray(parsed.what_to_fix) ? parsed.what_to_fix : [],
      coach_callouts: Array.isArray(parsed.coach_callouts) ? parsed.coach_callouts : [],
      next_focus: parsed.next_focus ?? '',
    };
  }
  return null;
}
// END ST-805B PR3

// Map numeric score to grade label
function gradeLabel(score: number): string {
  if (score >= 4.5) return 'Nailed it';
  if (score >= 3.5) return 'Sharp';
  if (score >= 2.5) return 'Solid';
  if (score >= 1.5) return 'Developing';
  return 'Rough';
}

function gradeColor(score: number): string {
  if (score >= 4.5) return 'text-emerald-400';
  if (score >= 3.5) return 'text-sky-400';
  if (score >= 2.5) return 'text-[#60B5FF]';
  if (score >= 1.5) return 'text-amber-400';
  return 'text-red-400';
}

function gradeBg(score: number): string {
  if (score >= 4.5) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 3.5) return 'bg-sky-500/10 border-sky-500/20';
  if (score >= 2.5) return 'bg-blue-500/10 border-blue-500/20';
  if (score >= 1.5) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

export function DebriefTab({ lesson, sessions, lessonId, onDebriefViewed }: DebriefTabProps) {
  const { data: session } = useSession() || {};
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [debriefMarked, setDebriefMarked] = useState(false);
  const [showHtmlReport, setShowHtmlReport] = useState(false);
  const [expandedPhases, setExpandedPhases] = useState<Record<string, boolean>>({});
  // START ST-802C Logic — Debrief Reveal (legacy)
  const [debriefReveal, setDebriefReveal] = useState<string[]>([]);
  // END ST-802C Logic
  // START ST-963 Logic — CFI Notes
  const [cfiNotes, setCfiNotes] = useState<string>('');
  // END ST-963 Logic

  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const [showRawData, setShowRawData] = useState(false);

  // START ST-805B PR3 — Structured debrief content from lesson
  const structuredDebrief = parseDebriefContent(lesson?.debriefContent);
  // END ST-805B PR3

  useEffect(() => {
    if ((sessions?.length ?? 0) > 0 && !selectedSession) {
      loadSession(sessions?.[0]?.id);
    }
  }, [sessions]);

  // START ST-802C Logic — Fetch debrief reveal when viewed
  useEffect(() => {
    if (debriefMarked && lesson?.lessonNum) {
      fetchDebriefReveal(lesson.lessonNum);
    }
  }, [debriefMarked, lesson?.lessonNum]);

  const fetchDebriefReveal = async (lessonNum: number) => {
    try {
      const res = await fetch(`/api/ground-school/${lessonNum}`);
      if (res?.ok) {
        const data = await res.json();
        setDebriefReveal(data?.debriefReveal ?? []);
        // START ST-963 Logic — Load CFI Notes if present
        setCfiNotes(data?.cfiNotes ?? '');
        // END ST-963 Logic
      }
    } catch (err: any) {
      // Silent — reveal is supplementary
    }
  };
  // END ST-802C Logic

  const loadSession = async (sessionId: string) => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res?.ok) {
        const data = await res.json();
        setSessionData(data);
        setSelectedSession(data);
      }
    } catch (err: any) {
      console.error('Failed to load session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDebrief = async () => {
    try {
      await fetch('/api/progress/debrief-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId }),
      });
      setDebriefMarked(true);
      onDebriefViewed?.();
    } catch (err: any) {
      console.error('Failed to mark debrief:', err);
    }
  };

  const togglePhase = (phase: string) => {
    setExpandedPhases((prev) => ({ ...prev, [phase]: !prev[phase] }));
  };

  if ((sessions?.length ?? 0) === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No flight sessions yet. Upload telemetry on the Flight tab first.</p>
      </div>
    );
  }

  const score = sessionData?.scores?.[0];
  const parsedData = sessionData?.parsedData;
  const sampledRows = parsedData?.sampledRows ?? [];
  const debriefHtml = parsedData?.debriefHtml ?? '';
  const debriefJson = parsedData?.debriefJson ?? score?.breakdown ?? {};

  // Engine output fields
  const overallScore = debriefJson?.overall_score ?? score?.overallScore ?? 0;
  const overallGrade = debriefJson?.overall_grade ?? gradeLabel(overallScore);
  const phases = debriefJson?.phases ?? [];
  const safetyFlags = debriefJson?.safety_flags ?? [];
  const coachingBullets = debriefJson?.coaching_bullets ?? [];
  const machadoQuiz = debriefJson?.machado_quiz;

  return (
    <div className="space-y-6">
      {/* Session selector */}
      {(sessions?.length ?? 0) > 1 && (
        <div className="flex gap-2 overflow-x-auto">
          {(sessions ?? []).map((s: any, idx: number) => (
            <button
              key={s?.id ?? idx}
              onClick={() => loadSession(s?.id)}
              className={`px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                sessionData?.id === s?.id
                  ? 'bg-[#60B5FF]/20 text-[#60B5FF] border border-[#60B5FF]/30'
                  : 'bg-muted/10 text-muted-foreground hover:bg-muted/20'
              }`}
            >
              {s?.csvFilename ?? `Session ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-[#60B5FF] border-t-transparent rounded-full" />
        </div>
      ) : sessionData ? (
        <>
          {/* Overall Score Card */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`p-5 rounded-xl border ${gradeBg(overallScore)}`}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-white">Flight Score</h3>
              <div className="text-right">
                <div className={`text-3xl font-mono font-bold ${gradeColor(overallScore)}`}>
                  {overallScore}<span className="text-lg text-muted-foreground">/5</span>
                </div>
                <p className={`text-xs font-semibold ${gradeColor(overallScore)}`}>{overallGrade}</p>
              </div>
            </div>

            {/* Safety flags */}
            {(safetyFlags?.length ?? 0) > 0 && (
              <div className="mt-3 space-y-1">
                {safetyFlags.map((flag: any, i: number) => (
                  <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-red-300 font-semibold">{flag?.name ?? 'Safety Flag'}</p>
                      <p className="text-[10px] text-red-400/80">{flag?.detail ?? ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Machado quiz result */}
            {machadoQuiz && (
              <div className={`mt-3 p-2 rounded-lg ${machadoQuiz?.passed ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                <p className={`text-xs font-semibold ${machadoQuiz?.passed ? 'text-emerald-400' : 'text-red-400'}`}>
                  📝 Machado Quiz: {machadoQuiz?.pct ?? 0}% — {machadoQuiz?.passed ? 'Passed' : 'Failed (need ≥ 80%)'}
                </p>
              </div>
            )}
          </motion.div>

          {/* START ST-805B PR3 — Structured Debrief Content */}
          {structuredDebrief && (
            <>
              {/* Summary */}
              {structuredDebrief.summary && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05 }}
                  className="p-5 rounded-xl bg-card/30 border border-border/30"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-[#60B5FF]" />
                    <h3 className="text-sm font-semibold text-white">Debrief Summary</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{structuredDebrief.summary}</p>
                </motion.div>
              )}

              {/* What You Did Well (Successes) */}
              {structuredDebrief.what_you_did_well.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.08 }}
                  className="p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <ThumbsUp className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-semibold text-white">What You Did Well</h3>
                  </div>
                  <ul className="space-y-2">
                    {structuredDebrief.what_you_did_well.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* What To Fix (Fixes) */}
              {structuredDebrief.what_to_fix.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.11 }}
                  className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">What To Fix</h3>
                  </div>
                  <ul className="space-y-2">
                    {structuredDebrief.what_to_fix.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-amber-400 text-xs mt-0.5">▸</span>
                        <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Coach Callouts */}
              {structuredDebrief.coach_callouts.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.14 }}
                  className="p-5 rounded-xl bg-purple-500/5 border border-purple-500/20"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Compass className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">Coach Callouts</h3>
                  </div>
                  <ul className="space-y-3">
                    {structuredDebrief.coach_callouts.map((item, i) => (
                      <li key={i} className="p-3 rounded-lg bg-purple-500/5 border border-purple-500/10">
                        <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}

              {/* Next Focus */}
              {structuredDebrief.next_focus && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.17 }}
                  className="p-4 rounded-xl bg-[#60B5FF]/5 border border-[#60B5FF]/20"
                >
                  <div className="flex items-start gap-2">
                    <ArrowRight className="w-4 h-4 text-[#60B5FF] flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-[#60B5FF] mb-1">Next Focus</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{structuredDebrief.next_focus}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </>
          )}
          {/* END ST-805B PR3 */}

          {/* START ST-802D Logic - GLGL Tracker for L2 */}
          {lesson?.lessonNum === 2 && parsedData?.l2_glgl && (
            <GLGLTracker data={parsedData.l2_glgl} />
          )}
          {/* END ST-802D Logic */}

          {/* Phase Breakdown */}
          {(phases?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="space-y-2"
            >
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-[#60B5FF]" />
                Phase Breakdown
              </h3>
              {phases.map((phase: any, pi: number) => {
                const pScore = phase?.score ?? 0;
                const pGrade = phase?.grade ?? gradeLabel(pScore);
                const isExpanded = expandedPhases[phase?.phase ?? pi] ?? false;
                const metrics = phase?.metrics ?? [];
                return (
                  <div key={pi} className="rounded-lg bg-card/30 border border-border/30 overflow-hidden">
                    <button
                      onClick={() => togglePhase(phase?.phase ?? String(pi))}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/10 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-white capitalize">{phase?.phase ?? 'Unknown'}</span>
                        <span className={`text-[10px] font-mono ${gradeColor(pScore)}`}>{pScore}/5 · {pGrade}</span>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </button>
                    {isExpanded && (metrics?.length ?? 0) > 0 && (
                      <div className="px-3 pb-3 space-y-1.5">
                        {metrics.map((m: any, mi: number) => (
                          <div key={mi} className="flex items-center justify-between p-2 rounded bg-muted/5">
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] text-white">{m?.name ?? 'Metric'}</p>
                              {m?.note && (
                                <p className="text-[10px] text-muted-foreground truncate">{m?.note}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                              {m?.value !== undefined && (
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {typeof m?.value === 'number' ? m?.value?.toFixed?.(1) : String(m?.value ?? '')}
                                  {m?.target !== undefined ? ` / ${m?.target}` : ''}
                                </span>
                              )}
                              <span className={`text-xs font-mono font-bold ${gradeColor(m?.score ?? 0)}`}>
                                {m?.score ?? '-'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* Charts */}
          {(sampledRows?.length ?? 0) > 0 && (
            <DebriefCharts rows={sampledRows} segments={[]} summary={null} lessonNum={lesson?.lessonNum ?? 0} />
          )}

          {/* Coaching Bullets (from scoring engine — shown when NO structured debrief) */}
          {!structuredDebrief && (coachingBullets?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="p-5 rounded-xl bg-card/30 border border-border/30"
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Coaching Notes</h3>
              </div>
              <ul className="space-y-2">
                {coachingBullets.map((bullet: string, bi: number) => (
                  <li key={bi} className="flex items-start gap-2">
                    <span className="text-amber-400 text-xs mt-0.5">▸</span>
                    <span className="text-sm text-muted-foreground leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Scoring engine coaching bullets (shown alongside structured debrief as supplementary) */}
          {structuredDebrief && (coachingBullets?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="p-5 rounded-xl bg-card/30 border border-border/30"
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Scoring Engine Notes</h3>
              </div>
              <ul className="space-y-2">
                {coachingBullets.map((bullet: string, bi: number) => (
                  <li key={bi} className="flex items-start gap-2">
                    <span className="text-amber-400 text-xs mt-0.5">▸</span>
                    <span className="text-sm text-muted-foreground leading-relaxed">{bullet}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}

          {/* Fallback coaching if no bullets from engine AND no structured debrief */}
          {!structuredDebrief && (coachingBullets?.length ?? 0) === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="p-5 rounded-xl bg-card/30 border border-border/30"
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">Coaching Notes</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {lesson?.debriefTemplate ?? 'Review your flight performance above and work on areas scoring below 3.'}
              </p>
            </motion.div>
          )}

          {/* Full HTML Debrief Report toggle */}
          {debriefHtml && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setShowHtmlReport(!showHtmlReport)}
              >
                <FileText className="w-4 h-4 mr-2" />
                {showHtmlReport ? 'Hide Full Debrief Report' : 'View Full Debrief Report'}
              </Button>
              {showHtmlReport && (
                <div className="mt-3 rounded-xl overflow-hidden border border-border/30">
                  <iframe
                    srcDoc={debriefHtml}
                    className="w-full bg-white rounded-xl"
                    style={{ minHeight: '600px', border: 'none' }}
                    title="Flight Debrief Report"
                    sandbox="allow-same-origin"
                  />
                </div>
              )}
            </motion.div>
          )}

          {/* Admin raw data panel */}
          {isAdmin && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-xs font-semibold text-purple-400">Raw Telemetry Debug</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowRawData(!showRawData)} className="text-xs">
                  <Eye className="w-3 h-3 mr-1" />
                  {showRawData ? 'Hide' : 'Show'}
                </Button>
              </div>
              {showRawData && (
                <div className="max-h-64 overflow-auto">
                  <pre className="text-[10px] font-mono text-muted-foreground whitespace-pre-wrap">
                    {JSON.stringify(parsedData, null, 2)?.slice?.(0, 5000) ?? 'No data'}
                  </pre>
                </div>
              )}
            </motion.div>
          )}

          {/* Mark debrief viewed button */}
          {!debriefMarked && (
            <Button onClick={handleMarkDebrief} className="w-full">
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark Debrief as Reviewed
            </Button>
          )}
          {debriefMarked && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-center">
              <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto" />
              <p className="text-xs text-emerald-400 mt-1">Debrief reviewed! Check the Path View for your progress.</p>
            </div>
          )}

          {/* START ST-802C Logic — Debrief Reveal: "What You Just Learned" (legacy — shown only if no structured debrief) */}
          {debriefMarked && !structuredDebrief && (debriefReveal?.length ?? 0) > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20"
            >
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-white">What You Just Learned</h3>
              </div>
              <ul className="space-y-2">
                {debriefReveal.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-400 text-xs mt-0.5">▸</span>
                    <span className="text-sm text-muted-foreground leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
          {/* END ST-802C Logic */}

          {/* START ST-963 Logic — CFI Notes (conditional, only if non-empty) */}
          {cfiNotes && cfiNotes.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-5 rounded-xl bg-purple-500/5 border border-purple-500/20"
            >
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-purple-300">CFI Notes</h3>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{cfiNotes}</p>
            </motion.div>
          )}
          {/* END ST-963 Logic */}
        </>
      ) : null}
    </div>
  );
}