// START ST-802D Logic — Quiz Seeds Submit API
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { submitQuizAttempt } from '@/lib/s2s-engine/quiz';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { lessonNum, answers } = body ?? {};

    if (!lessonNum || !Array.isArray(answers)) {
      return NextResponse.json({ error: 'lessonNum and answers[] required' }, { status: 400 });
    }

    const userId = (session?.user as any)?.id;
    const result = await submitQuizAttempt(userId, lessonNum, answers);

    // If passed, update UserProgress quizPassed flag
    if (result.passed) {
      // Find the lesson by lessonNum to get lessonId
      const lesson = await prisma.lesson.findUnique({ where: { lessonNum } });
      if (lesson) {
        await prisma.userProgress.upsert({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
          update: { quizPassed: true },
          create: { userId, lessonId: lesson.id, quizPassed: true, status: 'IN_PROGRESS' },
        });

        // Check if all gates now met
        const prog = await prisma.userProgress.findUnique({
          where: { userId_lessonId: { userId, lessonId: lesson.id } },
        });
        if (prog && (prog.flightScore ?? 0) >= 3 && prog.quizPassed && prog.debriefViewed) {
          await prisma.userProgress.update({
            where: { id: prog.id },
            data: { status: 'PASSED', completedAt: new Date() },
          });
        }
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('Quiz submit error:', error);
    return NextResponse.json({ error: error?.message ?? 'Failed to submit quiz' }, { status: 500 });
  }
}
// END ST-802D Logic
