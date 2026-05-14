'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Shield, Users, BookOpen, ArrowLeft, CheckCircle, XCircle, Zap, RefreshCw, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ARC_NAMES, ARC_COLORS } from '@/types/lessons';

export function AdminClient() {
  const router = useRouter();
  const [students, setStudents] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'students' | 'lessons'>('students');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [studentsRes, lessonsRes] = await Promise.all([
        fetch('/api/admin/students'),
        fetch('/api/lessons'),
      ]);
      if (studentsRes?.ok) setStudents(await studentsRes.json() ?? []);
      if (lessonsRes?.ok) setLessons(await lessonsRes.json() ?? []);
    } catch (err: any) {
      console.error('Admin fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleForceComplete = async (userId: string, lessonId: string) => {
    try {
      await fetch('/api/admin/force-complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, lessonId }),
      });
      fetchData();
    } catch (err: any) {
      console.error('Force complete error:', err);
    }
  };

  const handleToggleFlag = async (lessonId: string, flagKey: string, currentValue: boolean) => {
    try {
      await fetch('/api/admin/lesson-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, flags: { [flagKey]: !currentValue } }),
      });
      fetchData();
    } catch (err: any) {
      console.error('Toggle flag error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#0a1628]">
      <header className="sticky top-0 z-50 bg-[#0a1628]/80 backdrop-blur-md border-b border-border/30">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              <h1 className="text-lg font-display font-bold text-white">Admin Dashboard</h1>
            </div>
          </div>
          {/* START ST-900 Logic — Gradebook nav */}
          <Button variant="outline" size="sm" onClick={() => router.push('/admin/gradebook')} className="text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10">
            <ClipboardList className="w-3.5 h-3.5 mr-1" /> Gradebook
          </Button>
          {/* END ST-900 Logic */}
          <Button variant="ghost" size="sm" onClick={fetchData}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="max-w-5xl mx-auto px-4 pb-2 flex gap-2">
          <button
            onClick={() => setActiveTab('students')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'students'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Students
          </button>
          <button
            onClick={() => setActiveTab('lessons')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'lessons'
                ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Lessons
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full mx-auto" />
          </div>
        ) : activeTab === 'students' ? (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">{students?.length ?? 0} Student{(students?.length ?? 0) !== 1 ? 's' : ''}</h2>
            {(students?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No students registered yet.</p>
            ) : (
              (students ?? []).map((student: any, idx: number) => {
                const progressList = student?.progress ?? [];
                const passedCount = progressList.filter((p: any) => p?.status === 'PASSED')?.length ?? 0;

                return (
                  <motion.div
                    key={student?.id ?? idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="p-4 rounded-xl bg-card/30 border border-border/30"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-white">{student?.name ?? student?.email}</h3>
                        <p className="text-xs text-muted-foreground">{student?.email}</p>
                      </div>
                      <span className="text-xs font-mono text-[#60B5FF]">{passedCount}/17</span>
                    </div>

                    {/* Progress grid */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {Array.from({ length: 17 }, (_, i: number) => {
                        const lessonMatch = (lessons ?? []).find((l: any) => l?.lessonNum === i + 1);
                        const prog = progressList.find((p: any) => p?.lessonId === lessonMatch?.id);
                        const isPassed = prog?.status === 'PASSED';
                        return (
                          <div
                            key={i}
                            className={`w-6 h-6 rounded text-[9px] font-mono flex items-center justify-center ${
                              isPassed
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : prog
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-muted/20 text-muted-foreground'
                            }`}
                            title={`L${i + 1}: ${prog?.status ?? 'Not started'}`}
                          >
                            {i + 1}
                          </div>
                        );
                      })}
                    </div>

                    {/* Force complete buttons */}
                    <div className="flex flex-wrap gap-1">
                      {(lessons ?? []).slice(0, 4).map((lesson: any) => {
                        const prog = progressList.find((p: any) => p?.lessonId === lesson?.id);
                        if (prog?.status === 'PASSED') return null;
                        return (
                          <Button
                            key={lesson?.id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleForceComplete(student?.id, lesson?.id)}
                            className="text-[10px] h-6 px-2"
                          >
                            <Zap className="w-2.5 h-2.5 mr-1" />
                            Force L{lesson?.lessonNum}
                          </Button>
                        );
                      })}
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-white">Lesson Readiness</h2>
            {(lessons ?? []).map((lesson: any, idx: number) => {
              const flags = [
                { key: 'flightSchoolReady', label: 'Flight' },
                { key: 'groundSchoolReady', label: 'Ground' },
                { key: 'quizReady', label: 'Quiz' },
                { key: 'scoringReady', label: 'Scoring' },
                { key: 'mediaReady', label: 'Media' },
              ];
              const arcColor = ARC_COLORS[lesson?.arcNum ?? 1] ?? '#60B5FF';

              return (
                <motion.div
                  key={lesson?.id ?? idx}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: idx * 0.02 }}
                  className="p-3 rounded-xl bg-card/30 border border-border/30"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-mono" style={{ color: arcColor }}>L{lesson?.lessonNum}</span>
                    <span className="text-sm font-semibold text-white">{lesson?.title}</span>
                    {lesson?.isCheckFlight && (
                      <span className="px-1 py-0.5 text-[9px] font-mono bg-amber-500/20 text-amber-400 rounded">CHECK</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {flags.map((flag: any) => (
                      <button
                        key={flag?.key}
                        onClick={() => handleToggleFlag(lesson?.id, flag?.key, !!lesson?.[flag?.key])}
                        className={`px-2 py-1 rounded text-[10px] font-mono transition-all ${
                          lesson?.[flag?.key]
                            ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                            : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'
                        }`}
                      >
                        {lesson?.[flag?.key] ? <CheckCircle className="w-2.5 h-2.5 inline mr-0.5" /> : <XCircle className="w-2.5 h-2.5 inline mr-0.5" />}
                        {flag?.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
