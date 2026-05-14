// START ST-900 Logic — Fetch lessons for shadow user (admin impersonation)
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user || (role !== 'ADMIN' && role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req?.url ?? '');
    const userId = searchParams?.get?.('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    // Fetch all lessons with this user's progress
    const lessons = await prisma.lesson.findMany({
      orderBy: { lessonNum: 'asc' },
      include: {
        progress: {
          where: { userId },
          take: 1,
        },
      },
    });

    // Compute status for each lesson (same logic as /api/lessons)
    const result = (lessons ?? []).map((lesson: any, idx: number) => {
      const prog = lesson?.progress?.[0] ?? null;
      let computedStatus = 'LOCKED';

      if (prog?.status === 'PASSED') {
        computedStatus = 'PASSED';
      } else if (prog) {
        computedStatus = prog.status ?? 'IN_PROGRESS';
      } else {
        // Check if previous lesson is passed or if this is lesson 1
        if (lesson?.lessonNum === 1) {
          computedStatus = 'AVAILABLE';
        } else {
          const prevLesson = lessons?.[idx - 1];
          const prevProg = prevLesson?.progress?.[0];
          if (prevProg?.status === 'PASSED') {
            computedStatus = 'AVAILABLE';
          }
        }

        // Check readiness flags
        if (computedStatus === 'AVAILABLE' || computedStatus === 'LOCKED') {
          const allReady = lesson?.flightSchoolReady && lesson?.groundSchoolReady;
          if (!allReady && computedStatus === 'AVAILABLE') {
            computedStatus = 'PLACEHOLDER';
          }
        }
      }

      return {
        id: lesson?.id,
        lessonNum: lesson?.lessonNum,
        arcNum: lesson?.arcNum,
        title: lesson?.title,
        description: lesson?.description,
        isCheckFlight: lesson?.isCheckFlight,
        flightSchoolReady: lesson?.flightSchoolReady,
        groundSchoolReady: lesson?.groundSchoolReady,
        quizReady: lesson?.quizReady,
        scoringReady: lesson?.scoringReady,
        mediaReady: lesson?.mediaReady,
        computedStatus,
        progress: prog ? {
          flightScore: prog?.flightScore,
          quizPassed: prog?.quizPassed,
          debriefViewed: prog?.debriefViewed,
          status: prog?.status,
          completedAt: prog?.completedAt,
        } : null,
      };
    });

    return NextResponse.json(result ?? []);
  } catch (error: any) {
    console.error('Shadow lessons error:', error);
    return NextResponse.json({ error: 'Failed to fetch shadow lessons' }, { status: 500 });
  }
}
// END ST-900 Logic
