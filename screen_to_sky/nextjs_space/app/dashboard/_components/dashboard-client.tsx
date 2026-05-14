'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plane, LogOut, Shield, ChevronRight, Lock, CheckCircle, Circle, AlertTriangle, BookOpen, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ARC_NAMES, ARC_COLORS } from '@/types/lessons';
// START ST-900 Logic — Shadow mode imports
import { useShadow } from '@/lib/shadow-context';
// END ST-900 Logic

interface LessonWithStatus {
  id: string;
  lessonNum: number;
  arcNum: number;
  title: string;
  description: string;
  isCheckFlight: boolean;
  flightSchoolReady: boolean;
  groundSchoolReady: boolean;
  quizReady: boolean;
  scoringReady: boolean;
  mediaReady: boolean;
  computedStatus: string;
  progress: any;
}

export function DashboardClient() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  // START ST-900 Logic — Shadow mode + context menu state
  const { isActive: isShadowing, shadowUserId, shadowUserName, shadowUserEmail } = useShadow();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; lesson: LessonWithStatus } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  // END ST-900 Logic

  const isAdmin = (session?.user as any)?.role === 'ADMIN';
  const isInstructor = (session?.user as any)?.role === 'INSTRUCTOR';
  const isPrivileged = isAdmin || isInstructor;
  const userName = isShadowing
    ? (shadowUserName ?? shadowUserEmail ?? 'Student')
    : (session?.user?.name ?? session?.user?.email?.split?.('@')?.[0] ?? 'Pilot');

  // START ST-900 Logic — Fetch lessons (normal or shadow)
  const fetchLessons = useCallback(async () => {
    setLoading(true);
    try {
      const url = isShadowing && shadowUserId
        ? `/api/admin/shadow-lessons?userId=${shadowUserId}`
        : '/api/lessons';
      const res = await fetch(url);
      if (res?.ok) {
        const data = await res.json();
        setLessons(data ?? []);
      }
    } catch (err: any) {
      console.error('Failed to fetch lessons:', err);
    } finally {
      setLoading(false);
    }
  }, [isShadowing, shadowUserId]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  // Close context menu on click outside
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);
  // END ST-900 Logic

  const handleLessonClick = (lesson: LessonWithStatus) => {
    if (isShadowing) return; // Read-only in shadow mode
    if (isAdmin || lesson?.computedStatus !== 'LOCKED') {
      router.push(`/lesson/${lesson?.lessonNum}`);
    }
  };

  // START ST-900 Logic — Right-click context menu handlers
  const handleContextMenu = (e: React.MouseEvent, lesson: LessonWithStatus) => {
    if (!isPrivileged) return;
    const targetUserId = isShadowing ? shadowUserId : null;
    if (!isShadowing) return; // Context menu only available in shadow mode
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, lesson });
  };

  const handlePass = async (lesson: LessonWithStatus) => {
    if (!shadowUserId) return;
    setContextMenu(null);
    try {
      await fetch('/api/admin/force-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: shadowUserId, lessonId: lesson?.id }),
      });
      fetchLessons();
    } catch (err: any) {
      console.error('Force pass error:', err);
    }
  };

  const handleReset = async (lesson: LessonWithStatus) => {
    if (!shadowUserId) return;
    setContextMenu(null);
    try {
      await fetch('/api/admin/reset-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: shadowUserId, lessonId: lesson?.id }),
      });
      fetchLessons();
    } catch (err: any) {
      console.error('Reset error:', err);
    }
  };
  // END ST-900 Logic

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PASSED': return <CheckCircle className="w-5 h-5 text-emerald-400" />;
      case 'AVAILABLE': return <Circle className="w-5 h-5 text-[#60B5FF]" />;
      case 'IN_PROGRESS': return <Upload className="w-5 h-5 text-amber-400" />;
      case 'NEEDS_DEBRIEF': return <FileText className="w-5 h-5 text-amber-400" />;
      case 'NEEDS_GROUND_SCHOOL': return <BookOpen className="w-5 h-5 text-purple-400" />;
      case 'PLACEHOLDER': return <AlertTriangle className="w-5 h-5 text-muted-foreground" />;
      case 'LOCKED':
      default: return <Lock className="w-5 h-5 text-muted-foreground/50" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'PASSED': return 'Complete';
      case 'AVAILABLE': return 'Ready';
      case 'IN_PROGRESS': return 'In Progress';
      case 'NEEDS_DEBRIEF': return 'Needs Debrief';
      case 'NEEDS_GROUND_SCHOOL': return 'Needs Ground School';
      case 'PLACEHOLDER': return 'Coming Soon';
      case 'LOCKED':
      default: return 'Locked';
    }
  };

  const passedCount = (lessons ?? []).filter((l: LessonWithStatus) => l?.computedStatus === 'PASSED')?.length ?? 0;

  // Group lessons by arc
  const arcs: Record<number, LessonWithStatus[]> = {};
  for (const lesson of lessons ?? []) {
    const arc = lesson?.arcNum ?? 1;
    if (!arcs[arc]) arcs[arc] = [];
    arcs[arc].push(lesson);
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#0a1628] ${isShadowing ? 'pt-10' : ''}`}>
      {/* Header */}
      <header className={`sticky ${isShadowing ? 'top-10' : 'top-0'} z-50 bg-[#0a1628]/80 backdrop-blur-md border-b border-border/30`}>
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#60B5FF]/10 border border-[#60B5FF]/20 flex items-center justify-center">
              <Plane className="w-5 h-5 text-[#60B5FF]" />
            </div>
            <div>
              <h1 className="text-sm font-display font-bold text-white">Screen to Sky</h1>
              <p className="text-xs text-muted-foreground">Welcome, {userName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* START ST-900 Logic — Show admin nav only when not shadowing */}
            {isPrivileged && !isShadowing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/admin')}
                className="text-xs"
              >
                <Shield className="w-3.5 h-3.5 mr-1" />
                Admin
              </Button>
            )}
            {/* END ST-900 Logic */}
            {!isShadowing && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: '/login' })}
                className="text-xs"
              >
                <LogOut className="w-3.5 h-3.5 mr-1" />
                Sign Out
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-display font-semibold text-white">Flight Training Path</h2>
            <span className="text-sm text-muted-foreground font-mono">
              {passedCount}/{lessons?.length ?? 17} lessons
            </span>
          </div>
          <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${((passedCount / Math.max(lessons?.length ?? 1, 1)) * 100)}%` }}
              transition={{ duration: 1, delay: 0.3 }}
              className="h-full bg-gradient-to-r from-[#60B5FF] to-[#80D8C3] rounded-full"
            />
          </div>
        </motion.div>

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-8 h-8 border-2 border-[#60B5FF] border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground mt-4 text-sm">Loading training path...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(arcs).map(([arcNum, arcLessons]: [string, LessonWithStatus[]]) => {
              const arc = parseInt(arcNum, 10);
              const arcColor = ARC_COLORS[arc] ?? '#60B5FF';
              return (
                <motion.div
                  key={arc}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: arc * 0.1 }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: arcColor }}
                    />
                    <h3 className="text-sm font-display font-semibold" style={{ color: arcColor }}>
                      Arc {arc}: {ARC_NAMES[arc] ?? 'Unknown'}
                    </h3>
                  </div>

                  <div className="space-y-2">
                    {(arcLessons ?? []).map((lesson: LessonWithStatus, idx: number) => {
                      const isClickable = isAdmin || lesson?.computedStatus !== 'LOCKED';
                      const isPassed = lesson?.computedStatus === 'PASSED';
                      const isCheckFlight = lesson?.isCheckFlight;

                      return (
                        <motion.div
                          key={lesson?.id ?? idx}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: (arc * 0.1) + (idx * 0.05) }}
                          onClick={() => handleLessonClick(lesson)}
                          onContextMenu={(e: React.MouseEvent) => handleContextMenu(e, lesson)}
                          className={`
                            group relative flex items-center gap-4 p-4 rounded-lg border transition-all duration-200
                            ${isCheckFlight ? 'border-amber-500/30 bg-amber-500/5' : 'border-border/30 bg-card/30'}
                            ${isClickable && !isShadowing ? 'cursor-pointer hover:bg-card/50 hover:border-border/50 hover:shadow-md' : isShadowing ? 'cursor-default' : 'opacity-50 cursor-not-allowed'}
                            ${isPassed ? 'border-emerald-500/30 bg-emerald-500/5' : ''}
                          `}
                        >
                          {/* Connection line */}
                          {idx < (arcLessons?.length ?? 0) - 1 && (
                            <div className="absolute left-[2.05rem] top-[3.25rem] w-px h-[calc(100%-1rem)] bg-border/20" />
                          )}

                          <div className="flex-shrink-0 relative z-10">
                            {getStatusIcon(lesson?.computedStatus ?? 'LOCKED')}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">
                                L{lesson?.lessonNum}
                              </span>
                              <h4 className="text-sm font-semibold text-white truncate">
                                {lesson?.title ?? 'Untitled'}
                              </h4>
                              {isCheckFlight && (
                                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-amber-500/20 text-amber-400 rounded">
                                  CHECK
                                </span>
                              )}
                              {/* START ST-802D Logic - L2 GLGL Badge */}
                              {lesson?.lessonNum === 2 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-mono bg-[#60B5FF]/20 text-[#60B5FF] rounded">
                                  GLGL
                                </span>
                              )}
                              {/* END ST-802D Logic */}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {lesson?.description ?? ''}
                            </p>
                            {/* START ST-802D Logic - L2 GLGL Subtext */}
                            {lesson?.lessonNum === 2 && (
                              <p className="text-[10px] text-[#60B5FF]/80 mt-0.5">
                                2 Go-Arounds + 2 Landings required
                              </p>
                            )}
                            {/* END ST-802D Logic */}
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground">
                              {getStatusLabel(lesson?.computedStatus ?? 'LOCKED')}
                            </span>
                            {lesson?.progress?.flightScore && (
                              <span className="text-xs font-mono text-[#60B5FF]">
                                {lesson.progress.flightScore}/5
                              </span>
                            )}
                            {isClickable && (
                              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>

      {/* START ST-900 Logic — Right-click context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            ref={contextMenuRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1 }}
            className="fixed z-[9998] bg-[#1a2744] border border-purple-500/30 rounded-lg shadow-xl overflow-hidden"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div className="px-3 py-1.5 border-b border-border/20">
              <p className="text-[10px] font-mono text-purple-400">
                L{contextMenu.lesson?.lessonNum} — Manual Override
              </p>
            </div>
            <button
              onClick={() => handlePass(contextMenu.lesson)}
              className="w-full px-3 py-2 text-xs text-left text-emerald-400 hover:bg-emerald-500/10 transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Pass Lesson
            </button>
            <button
              onClick={() => handleReset(contextMenu.lesson)}
              className="w-full px-3 py-2 text-xs text-left text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Reset Lesson
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      {/* END ST-900 Logic */}
    </div>
  );
}
