// START ST-900 Logic — Gradebook Client: Roster + Session Drill-Down
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ArrowLeft, RefreshCw, Users, Eye, ChevronDown, ChevronUp,
  Clock, Target, Activity, Calendar, Search, X, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ARC_COLORS } from '@/types/lessons';
import { useShadow } from '@/lib/shadow-context';

const SCORE_LABELS: Record<number, string> = {
  1: 'Rough',
  2: 'Developing',
  3: 'Solid',
  4: 'Sharp',
  5: 'Nailed it',
};

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  ACTIVE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Active' },
  IDLE: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Idle' },
  INACTIVE: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Inactive' },
  NEW: { bg: 'bg-[#60B5FF]/20', text: 'text-[#60B5FF]', label: 'New' },
};

function getScoreColor(score: number): string {
  if (score >= 4.5) return 'text-emerald-400';
  if (score >= 3) return 'text-[#60B5FF]';
  if (score >= 2) return 'text-amber-400';
  return 'text-red-400';
}

interface StudentData {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  currentLesson: number;
  avgFlightScore: number | null;
  lastFlightDate: string | null;
  activityStatus: string;
  passedCount: number;
  progress: any[];
  sessions: any[];
}

export function GradebookClient() {
  const router = useRouter();
  const { enterShadow } = useShadow();
  const [students, setStudents] = useState<StudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/gradebook');
      if (res?.ok) {
        const data = await res.json();
        setStudents(data ?? []);
      }
    } catch (err: any) {
      console.error('Gradebook fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = (students ?? []).filter((s: StudentData) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s?.name ?? '').toLowerCase().includes(q) ||
      (s?.email ?? '').toLowerCase().includes(q)
    );
  });

  const handleShadow = (student: StudentData) => {
    enterShadow(student.id, student.name ?? student.email, student.email);
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#0a1628]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a1628]/80 backdrop-blur-md border-b border-border/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/admin')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <h1 className="text-lg font-display font-bold text-white">Gradebook</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search students..."
                value={search}
                onChange={(e) => setSearch(e?.target?.value ?? '')}
                className="pl-8 pr-8 py-1.5 text-xs rounded-lg bg-card/30 border border-border/30 text-white placeholder:text-muted-foreground focus:outline-none focus:border-purple-500/50 w-48"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                  <X className="w-3 h-3 text-muted-foreground hover:text-white" />
                </button>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={fetchData}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* Summary bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/30 border border-border/30">
            <Users className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-mono text-white">{filtered?.length ?? 0} student{(filtered?.length ?? 0) !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : (filtered?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No students found.</p>
        ) : (
          <div className="space-y-2">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-4 py-2 text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              <span>Student</span>
              <span>Current Lesson</span>
              <span>Avg Score</span>
              <span>Last Flight</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {/* Student rows */}
            {(filtered ?? []).map((student: StudentData, idx: number) => {
              const isExpanded = expandedId === student?.id;
              const statusStyle = STATUS_COLORS[student?.activityStatus ?? 'NEW'] ?? STATUS_COLORS.NEW;

              return (
                <motion.div
                  key={student?.id ?? idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  {/* Main row */}
                  <div
                    className={`grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-2 items-center px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                      isExpanded
                        ? 'bg-purple-500/10 border-purple-500/30'
                        : 'bg-card/30 border-border/30 hover:bg-card/40 hover:border-border/50'
                    }`}
                    onClick={() => setExpandedId(isExpanded ? null : (student?.id ?? null))}
                  >
                    {/* Name/Email */}
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400">
                        {(student?.name ?? student?.email ?? '?')[0]?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{student?.name ?? 'Unnamed'}</p>
                        <p className="text-[10px] text-muted-foreground">{student?.email}</p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5 text-muted-foreground ml-auto md:hidden" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground ml-auto md:hidden" />
                      )}
                    </div>

                    {/* Current Lesson */}
                    <div className="flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5 text-[#60B5FF] md:hidden" />
                      <span className="text-xs font-mono text-white">L{student?.currentLesson ?? '?'}</span>
                      <span className="text-[10px] text-muted-foreground">({student?.passedCount ?? 0}/17)</span>
                    </div>

                    {/* Avg Score */}
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-[#60B5FF] md:hidden" />
                      {student?.avgFlightScore != null ? (
                        <span className={`text-sm font-mono font-bold ${getScoreColor(student.avgFlightScore)}`}>
                          {student.avgFlightScore}/5
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>

                    {/* Last Flight */}
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#60B5FF] md:hidden" />
                      <span className="text-xs text-muted-foreground">
                        {student?.lastFlightDate
                          ? new Date(student.lastFlightDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </span>
                    </div>

                    {/* Status */}
                    <div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${statusStyle.bg} ${statusStyle.text}`}>
                        {statusStyle.label}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1" onClick={(e) => e?.stopPropagation?.()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleShadow(student)}
                        className="text-[10px] h-7 px-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                      >
                        <Eye className="w-3 h-3 mr-1" /> View as Student
                      </Button>
                    </div>
                  </div>

                  {/* Expanded: Session Drill-Down */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <SessionDrillDown student={student} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

// --- Session Drill-Down Panel ---
function SessionDrillDown({ student }: { student: StudentData }) {
  const sessions = student?.sessions ?? [];
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="px-6 py-4 ml-4 border-l-2 border-purple-500/20">
        <p className="text-xs text-muted-foreground">No flight sessions recorded.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-3 ml-4 border-l-2 border-purple-500/20 space-y-2">
      <h4 className="text-[10px] font-mono text-purple-400 uppercase tracking-wider mb-2">
        Flight History ({sessions.length} session{sessions.length !== 1 ? 's' : ''})
      </h4>

      {sessions.map((s: any, idx: number) => {
        const score = s?.scores?.[0];
        const arcColor = ARC_COLORS[s?.lesson?.arcNum ?? 1] ?? '#60B5FF';
        const isOpen = expandedSession === s?.id;
        const parsedData = s?.parsedData as any;
        const debriefHtml = parsedData?.debriefHtml ?? parsedData?.l2_glgl?.debriefHtml ?? null;

        return (
          <div key={s?.id ?? idx} className="rounded-lg bg-card/20 border border-border/20 overflow-hidden">
            <div
              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-card/30 transition-colors"
              onClick={() => setExpandedSession(isOpen ? null : (s?.id ?? null))}
            >
              <span className="text-[10px] font-mono" style={{ color: arcColor }}>
                L{s?.lesson?.lessonNum ?? '?'}
              </span>
              <span className="text-xs text-white flex-1 truncate">
                {s?.lesson?.title ?? s?.csvFilename ?? 'Session'}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {new Date(s?.uploadTimestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
              </span>
              {score && (
                <span className={`text-xs font-mono font-bold ${getScoreColor(score?.overallScore ?? 0)}`}>
                  {score?.overallScore ?? '?'}/5
                </span>
              )}
              <span className="text-[10px] text-muted-foreground">
                {Math.round((s?.durationSec ?? 0) / 60)}m
              </span>
              {isOpen ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
            </div>

            <AnimatePresence>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 py-3 border-t border-border/20 space-y-3">
                    {/* Score Breakdown */}
                    {score?.breakdown && (
                      <div>
                        <h5 className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">Score Breakdown</h5>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                          {Object.entries(score.breakdown as Record<string, any>).map(([key, val]: [string, any]) => {
                            const s = typeof val === 'object' ? (val?.score ?? val) : val;
                            const numScore = typeof s === 'number' ? s : 0;
                            return (
                              <div key={key} className="px-2 py-1.5 rounded bg-card/30 border border-border/20">
                                <p className="text-[9px] text-muted-foreground capitalize">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </p>
                                <p className={`text-xs font-mono font-bold ${getScoreColor(numScore)}`}>
                                  {numScore}/5 <span className="text-[9px] font-normal text-muted-foreground">{SCORE_LABELS[numScore] ?? ''}</span>
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Attempts / Telemetry */}
                    {(s?.attempts?.length ?? 0) > 0 && (
                      <div>
                        <h5 className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5">Flight Segments</h5>
                        <div className="flex flex-wrap gap-1">
                          {(s?.attempts ?? []).map((a: any, ai: number) => (
                            <span
                              key={ai}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                                a?.confidence === 'HIGH' ? 'bg-emerald-500/15 text-emerald-400' :
                                a?.confidence === 'MEDIUM' ? 'bg-amber-500/15 text-amber-400' :
                                'bg-red-500/15 text-red-400'
                              }`}
                            >
                              {a?.segmentType ?? 'segment'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Debrief HTML */}
                    {debriefHtml && (
                      <div>
                        <h5 className="text-[10px] font-mono text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                          <FileText className="w-3 h-3" /> Debrief
                        </h5>
                        <div
                          className="prose prose-invert prose-xs max-w-none text-xs bg-card/20 rounded-lg p-3 border border-border/20"
                          dangerouslySetInnerHTML={{ __html: debriefHtml }}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
// END ST-900 Logic
