export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { lessonNum: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lessonNum = parseInt(params?.lessonNum ?? '0', 10);
    if (isNaN(lessonNum)) {
      return NextResponse.json({ error: 'Invalid lesson number' }, { status: 400 });
    }

    const lesson = await prisma.lesson.findUnique({
      where: { lessonNum },
    });

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    const userId = (session?.user as any)?.id;
    const role = (session?.user as any)?.role;

    // Get user progress
    let progress = null;
    if (userId) {
      progress = await prisma.userProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
      });
    }

    // Get flight sessions for this lesson
    const flightSessions = await prisma.flightSession.findMany({
      where: { userId: userId ?? '', lessonId: lesson.id },
      include: { scores: true, attempts: true },
      orderBy: { uploadTimestamp: 'desc' },
      take: 10,
    });

    // Get quiz if check flight (legacy Quiz model)
    let quiz = null;
    if (lesson?.checkFlightQuizNum) {
      quiz = await prisma.quiz.findUnique({
        where: { quizNum: lesson.checkFlightQuizNum },
      });
    }

    // START ST-802D Logic — Check QuizSeed availability + latest attempt
    const quizSeedCount = await prisma.quizSeed.count({ where: { lessonNum } });
    let latestQuizAttempt = null;
    if (userId && quizSeedCount > 0) {
      latestQuizAttempt = await prisma.quizAttempt.findFirst({
        where: { userId, lessonNum },
        orderBy: { createdAt: 'desc' },
      });
    }
    // END ST-802D Logic

    return NextResponse.json({
      lesson,
      progress,
      flightSessions: flightSessions ?? [],
      quiz,
      hasQuizSeeds: quizSeedCount > 0,
      latestQuizAttempt,
      isAdmin: role === 'ADMIN',
    });
  } catch (error: any) {
    console.error('Lesson fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch lesson' }, { status: 500 });
  }
}
