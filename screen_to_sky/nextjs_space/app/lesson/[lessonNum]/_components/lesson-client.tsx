'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, BookOpen, Plane, Upload, FileText, CheckCircle, AlertTriangle, Shield, GraduationCap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BriefTab } from './brief-tab';
import { GroundSchoolTab } from './ground-school-tab';
import { FlightTab } from './flight-tab';
import { DebriefTab } from './debrief-tab';
import { QuizTab } from './quiz-tab';
import { QuizSeedTab } from './quiz-seed-tab';
import { ARC_NAMES, ARC_COLORS } from '@/types/lessons';

interface LessonClientProps {
  lessonNum: string;
}

export function LessonClient({ lessonNum }: LessonClientProps) {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('brief');

  const isAdmin = (session?.user as any)?.role === 'ADMIN';

  useEffect(() => {
    fetchLesson();
  }, [lessonNum]);

  const fetchLesson = async () => {
    try {
      const res = await fetch(`/api/lessons/${lessonNum}`);
      if (res?.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err: any) {
      console.error('Failed to fetch lesson:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#0a1628] flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-[#60B5FF] border-t-transparent rounded-full" />
      </div>
    );
  }

  const lesson = data?.lesson;
  const progress = data?.progress;
  const flightSessions = data?.flightSessions ?? [];
  const quiz = data?.quiz;
  const arcColor = ARC_COLORS[lesson?.arcNum ?? 1] ?? '#60B5FF';

  // START ST-802C/D Logic — Tab configuration with Ground School + Quiz
  const hasGroundSchool = lesson?.groundSchoolReady === true;
  const hasQuizSeed = lesson?.quizReady === true;
  // Legacy quiz for check flights that use the old Quiz model
  const hasLegacyQuiz = lesson?.isCheckFlight && quiz;

  const tabs = [
    { id: 'brief', label: 'Brief', icon: BookOpen },
    ...(hasGroundSchool ? [{ id: 'ground-school', label: 'Ground School', icon: GraduationCap }] : []),
    ...(hasQuizSeed ? [{ id: 'quiz-seed', label: 'Quiz', icon: FileText }] : []),
    ...(hasLegacyQuiz && !hasQuizSeed ? [{ id: 'quiz', label: 'Quiz', icon: FileText }] : []),
    { id: 'flight', label: 'Flight', icon: Upload },
    { id: 'debrief', label: 'Debrief', icon: FileText },
  ];
  // END ST-802C/D Logic

  const readinessFlags = [
    { key: 'flightSchoolReady', label: 'Flight School' },
    { key: 'groundSchoolReady', label: 'Ground School' },
    { key: 'quizReady', label: 'Quiz' },
    { key: 'scoringReady', label: 'Scoring' },
    { key: 'mediaReady', label: 'Media' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f1f3d] to-[#0a1628]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a1628]/80 backdrop-blur-md border-b border-border/30">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono" style={{ color: arcColor }}>
                  Arc {lesson?.arcNum} · L{lesson?.lessonNum}
                </span>
                {lesson?.isCheckFlight && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono bg-amber-500/20 text-amber-400 rounded">
                    CHECK FLIGHT
                  </span>
                )}
                {isAdmin && (
                  <span className="px-1.5 py-0.5 text-[10px] font-mono bg-purple-500/20 text-purple-400 rounded flex items-center gap-1">
                    <Shield className="w-2.5 h-2.5" /> ADMIN
                  </span>
                )}
              </div>
              <h1 className="text-lg font-display font-bold text-white">{lesson?.title ?? 'Lesson'}</h1>
            </div>
            {progress?.flightScore && (
              <div className="text-right">
                <div className="text-2xl font-mono font-bold text-[#60B5FF]">{progress.flightScore}/5</div>
                <div className="text-[10px] text-muted-foreground">Flight Score</div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-3 overflow-x-auto">
            {tabs.map((tab: any) => {
              const Icon = tab?.icon;
              return (
                <button
                  key={tab?.id}
                  onClick={() => setActiveTab(tab?.id ?? 'brief')}
                  className={`
                    flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                    ${activeTab === tab?.id
                      ? 'bg-[#60B5FF]/20 text-[#60B5FF] border border-[#60B5FF]/30'
                      : 'text-muted-foreground hover:text-white hover:bg-muted/20'
                    }
                  `}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  {tab?.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Admin readiness flags */}
        {isAdmin && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-3 rounded-lg bg-purple-500/5 border border-purple-500/20"
          >
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-purple-400" />
              <span className="text-xs font-semibold text-purple-400">Content Readiness</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {readinessFlags.map((flag: any) => (
                <span
                  key={flag?.key}
                  className={`px-2 py-1 rounded text-[10px] font-mono ${
                    lesson?.[flag?.key]
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-muted/20 text-muted-foreground'
                  }`}
                >
                  {lesson?.[flag?.key] ? <CheckCircle className="w-2.5 h-2.5 inline mr-1" /> : <AlertTriangle className="w-2.5 h-2.5 inline mr-1" />}
                  {flag?.label}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'brief' && <BriefTab lesson={lesson} />}
            {activeTab === 'ground-school' && <GroundSchoolTab lesson={lesson} />}
            {activeTab === 'quiz-seed' && <QuizSeedTab lesson={lesson} onComplete={fetchLesson} />}
            {activeTab === 'quiz' && <QuizTab quiz={quiz} lessonId={lesson?.id} onComplete={fetchLesson} />}
            {activeTab === 'flight' && <FlightTab lesson={lesson} sessions={flightSessions} onUpload={fetchLesson} />}
            {activeTab === 'debrief' && <DebriefTab lesson={lesson} sessions={flightSessions} lessonId={lesson?.id} onDebriefViewed={fetchLesson} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
