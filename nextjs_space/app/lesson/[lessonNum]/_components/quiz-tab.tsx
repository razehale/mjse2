'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, XCircle, HelpCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuizTabProps {
  quiz: any;
  lessonId: string;
  onComplete: () => void;
}

export function QuizTab({ quiz, lessonId, onComplete }: QuizTabProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const questions = (quiz?.questions as any[]) ?? [];
  const hasTodoQuestions = (questions?.length ?? 0) > 0 && questions?.[0]?.question?.includes?.('TODO');

  const handleSelect = (qIdx: number, optIdx: number) => {
    if (result) return;
    setAnswers((prev: Record<number, number>) => ({ ...(prev ?? {}), [qIdx]: optIdx }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers ?? {})?.length < (questions?.length ?? 0)) return;
    setSubmitting(true);

    try {
      const orderedAnswers = questions.map((_: any, idx: number) => answers?.[idx] ?? 0);
      const res = await fetch('/api/quiz/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizNum: quiz?.quizNum, answers: orderedAnswers }),
      });

      if (res?.ok) {
        const data = await res.json();
        setResult(data);
        onComplete?.();
      }
    } catch (err: any) {
      console.error('Quiz submit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  if (!quiz) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <HelpCircle className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No quiz available for this lesson.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-4 rounded-xl bg-card/30 border border-border/30">
        <h3 className="text-sm font-semibold text-white">{quiz?.title ?? 'Quiz'}</h3>
        <p className="text-xs text-muted-foreground mt-1">Required score: {quiz?.requiredScore ?? 80}%</p>
      </div>

      {hasTodoQuestions && (
        <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span className="text-xs text-amber-400">Some questions are placeholder content awaiting curriculum specialist review.</span>
        </div>
      )}

      {(questions ?? []).map((q: any, qIdx: number) => (
        <motion.div
          key={qIdx}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: qIdx * 0.05 }}
          className="p-4 rounded-xl bg-card/30 border border-border/30"
        >
          <p className="text-sm text-white mb-3">
            <span className="font-mono text-muted-foreground mr-2">Q{qIdx + 1}.</span>
            {q?.question}
          </p>
          <div className="space-y-2">
            {(q?.options ?? []).map((opt: string, optIdx: number) => {
              const isSelected = answers?.[qIdx] === optIdx;
              const isCorrect = result?.results?.[qIdx]?.correct === optIdx;
              const isWrong = result && isSelected && !result?.results?.[qIdx]?.isCorrect;

              return (
                <button
                  key={optIdx}
                  onClick={() => handleSelect(qIdx, optIdx)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center gap-2 ${
                    result
                      ? isCorrect
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : isWrong
                        ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                        : 'bg-muted/10 text-muted-foreground border border-transparent'
                      : isSelected
                      ? 'bg-[#60B5FF]/20 text-[#60B5FF] border border-[#60B5FF]/30'
                      : 'bg-muted/10 text-muted-foreground border border-transparent hover:bg-muted/20'
                  }`}
                >
                  <span className="w-5 h-5 rounded-full border text-[10px] flex items-center justify-center flex-shrink-0">
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  {opt}
                  {result && isCorrect && <CheckCircle className="w-3.5 h-3.5 ml-auto text-emerald-400" />}
                  {isWrong && <XCircle className="w-3.5 h-3.5 ml-auto text-red-400" />}
                </button>
              );
            })}
          </div>
          {result && result?.results?.[qIdx] && (
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              {q?.explanation}
            </p>
          )}
        </motion.div>
      ))}

      {!result ? (
        <Button
          onClick={handleSubmit}
          disabled={submitting || Object.keys(answers ?? {})?.length < (questions?.length ?? 0)}
          className="w-full"
        >
          {submitting ? 'Submitting...' : 'Submit Quiz'}
        </Button>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-4 rounded-xl border text-center ${
            result?.passed
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          {result?.passed ? (
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
          ) : (
            <XCircle className="w-8 h-8 text-red-400 mx-auto" />
          )}
          <p className="text-sm font-semibold text-white mt-2">
            {result?.passed ? 'Quiz Passed!' : 'Quiz Not Passed'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Score: {result?.correct ?? 0}/{result?.total ?? 0} ({result?.scorePercent ?? 0}%)
          </p>
        </motion.div>
      )}
    </div>
  );
}
