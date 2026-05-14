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
    const { lessonId } = body ?? {};

    if (!lessonId) {
      return NextResponse.json({ error: 'lessonId required' }, { status: 400 });
    }

    const userId = (session?.user as any)?.id;

    const progress = await prisma.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: { debriefViewed: true },
      create: { userId, lessonId, debriefViewed: true, status: 'IN_PROGRESS' },
    });

    // START ST-802D Logic — Dynamic quiz-aware gate check
    // Determine if this lesson requires a quiz by checking QuizSeed rows
    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    const quizSeedCount = lesson ? await prisma.quizSeed.count({ where: { lessonNum: lesson.lessonNum } }) : 0;
    const requiresQuiz = quizSeedCount > 0 || lesson?.isCheckFlight;

    const flightOk = (progress?.flightScore ?? 0) >= 3;
    const quizOk = requiresQuiz ? progress?.quizPassed : true;
    const debriefOk = progress?.debriefViewed;

    if (flightOk && quizOk && debriefOk) {
      await prisma.userProgress.update({
        where: { id: progress.id },
        data: { status: 'PASSED', completedAt: new Date() },
      });
    }
    // END ST-802D Logic

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Debrief viewed error:', error);
    return NextResponse.json({ error: 'Failed to update progress' }, { status: 500 });
  }
}
