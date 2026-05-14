export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { quizNum, answers } = body ?? {};

    if (!quizNum || !answers) {
      return NextResponse.json({ error: 'quizNum and answers required' }, { status: 400 });
    }

    const quiz = await prisma.quiz.findUnique({ where: { quizNum } });
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const questions = (quiz?.questions as any[]) ?? [];
    let correct = 0;
    const results = (answers ?? []).map((answer: number, idx: number) => {
      const q = questions?.[idx];
      const isCorrect = answer === q?.correctIndex;
      if (isCorrect) correct++;
      return { questionIndex: idx, selected: answer, correct: q?.correctIndex, isCorrect };
    });

    const total = questions?.length ?? 1;
    const scorePercent = Math.round((correct / total) * 100);
    const passed = scorePercent >= (quiz?.requiredScore ?? 80);

    // Find the check flight lesson for this quiz
    const lesson = await prisma.lesson.findFirst({
      where: { checkFlightQuizNum: quizNum },
    });

    const userId = (session?.user as any)?.id;
    if (lesson && userId) {
      await prisma.userProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
        update: { quizPassed: passed },
        create: { userId, lessonId: lesson.id, quizPassed: passed, status: 'IN_PROGRESS' },
      });
    }

    return NextResponse.json({ correct, total, scorePercent, passed, results });
  } catch (error: any) {
    console.error('Quiz submit error:', error);
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 });
  }
}
