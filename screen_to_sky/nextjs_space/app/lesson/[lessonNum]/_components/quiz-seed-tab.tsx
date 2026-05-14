// START ST-802D Logic — Quiz Seed Tab Component
'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuizSeedTabProps {
  lesson: any;
  onComplete: () => void;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

interface QuizResult {
  correctCount: number;
  totalCount: number;
  passed: boolean;
  results: {
    question: string;
    options: string[];
    correctIndex: number;
    userAnswer: number;
    isCorrect: boolean;
    explanation: string;
  }[];
}

export function QuizSeedTab({ lesson, onComplete }: QuizSeedTabProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (lesson?.lessonNum) {
      loadQuiz(lesson.lessonNum);
    }
  }, [lesson?.lessonNum]);

  const loadQuiz = async (lessonNum: number) => {
    try {
      const res = await fetch(`/api/quiz-seeds/${lessonNum}`);
      if (res?.ok) {
        const data = await res.json();
        setQuestions(data?.questions ?? []);
      } else {
        setError('Quiz not available for this lesson.');
      }
    } catch (err: any) {
      setError('Failed to load quiz.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (qIndex: number, optIndex: number) => {
    if (result) return; // locked after submit
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      setError('Answer all questions before submitting.');
      return;
    }
    setError('');
    setSubmitting(true);

    try {
      // Build ordered answers array
      const orderedAnswers = questions.map((_, i) => answers[i] ?? -1);

      const res = await fetch('/api/quiz-seeds/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonNum: lesson?.lessonNum,
          answers: orderedAnswers,
        }),
      });

      if (!res?.ok) {
        const d = await res?.json?.();
        throw new Error(d?.error ?? 'Submit failed');
      }

      const data = await res.json();
      setResult(data);
      if (data?.passed) {
        onComplete?.();
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to submit quiz');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setAnswers({});
    setError('');
  };

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin w-6 h-6 border-2 border-[#60B5FF] border-t-transparent rounded-full" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No quiz questions available for this lesson yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Result banner */}
      {result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`p-5 rounded-xl border text-center ${
            result.passed
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : 'bg-red-500/10 border-red-500/30'
          }`}
        >
          {result.passed ? (
            <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto" />
          ) : (
            <XCircle className="w-8 h-8 text-red-400 mx-auto" />
          )}
          <p className={`text-lg font-bold mt-2 ${
            result.passed ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {result.correctCount} / {result.totalCount}
          </p>
          <p className={`text-sm mt-1 ${
            result.passed ? 'text-emerald-400/80' : 'text-red-400/80'
          }`}>
            {result.passed
              ? 'Quiz passed! Great work.'
              : `Need ${Math.max(1, result.totalCount - 1)} correct to pass. Review and try again.`}
          </p>
          {!result.passed && (
            <Button variant="outline" size="sm" className="mt-3" onClick={handleRetry}>
              Retry Quiz
            </Button>
          )}
        </motion.div>
      )}

      {/* Questions */}
      {questions.map((q, qi) => {
        const r = result?.results?.[qi];
        const options: string[] = Array.isArray(q.options) ? q.options : [];

        return (
          <motion.div
            key={q.id ?? qi}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: qi * 0.05 }}
            className="p-5 rounded-xl bg-card/30 border border-border/30"
          >
            <p className="text-sm font-semibold text-white mb-3">
              <span className="text-muted-foreground font-mono mr-2">Q{qi + 1}.</span>
              {q.question}
            </p>

            <div className="space-y-2">
              {options.map((opt: string, oi: number) => {
                const isSelected = answers[qi] === oi;
                let optStyle = 'bg-muted/10 border-border/30 hover:bg-muted/20';

                if (result && r) {
                  if (oi === r.correctIndex) {
                    optStyle = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300';
                  } else if (oi === r.userAnswer && !r.isCorrect) {
                    optStyle = 'bg-red-500/15 border-red-500/40 text-red-300';
                  } else {
                    optStyle = 'bg-muted/5 border-border/20 opacity-60';
                  }
                } else if (isSelected) {
                  optStyle = 'bg-[#60B5FF]/15 border-[#60B5FF]/40 text-[#60B5FF]';
                }

                return (
                  <button
                    key={oi}
                    onClick={() => handleSelect(qi, oi)}
                    disabled={!!result}
                    className={`w-full text-left p-3 rounded-lg border text-sm transition-all ${optStyle}`}
                  >
                    <span className="font-mono text-xs mr-2 opacity-60">
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    {opt}
                    {result && r && oi === r.correctIndex && (
                      <CheckCircle className="w-3.5 h-3.5 inline ml-2 text-emerald-400" />
                    )}
                    {result && r && oi === r.userAnswer && !r.isCorrect && (
                      <XCircle className="w-3.5 h-3.5 inline ml-2 text-red-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation after submit */}
            {result && r && (
              <div className={`mt-3 p-3 rounded-lg text-xs ${
                r.isCorrect ? 'bg-emerald-500/5 text-emerald-400/80' : 'bg-amber-500/5 text-amber-400/80'
              }`}>
                {r.explanation}
              </div>
            )}
          </motion.div>
        );
      })}

      {/* Submit */}
      {!result && (
        <div className="space-y-2">
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
          <Button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(answers).length < questions.length}
            className="w-full"
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Submitting...</>
            ) : (
              <>Submit Quiz ({Object.keys(answers).length}/{questions.length} answered)</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
// END ST-802D Logic
