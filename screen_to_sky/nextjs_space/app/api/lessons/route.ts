export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const lessons = await prisma.lesson.findMany({
      orderBy: { lessonNum: 'asc' },
    });

    const userId = (session?.user as any)?.id;
    const role = (session?.user as any)?.role;

    // Get user progress for all lessons
    let progress: any[] = [];
    if (userId) {
      progress = await prisma.userProgress.findMany({
        where: { userId },
      });
    }

    const progressMap: Record<string, any> = {};
    for (const p of progress ?? []) {
      progressMap[p?.lessonId ?? ''] = p;
    }

    // Compute lesson statuses
    const lessonsWithStatus = (lessons ?? []).map((lesson: any, idx: number) => {
      const prog = progressMap[lesson?.id ?? ''];
      let status = 'LOCKED';

      if (role === 'ADMIN') {
        status = prog?.status ?? 'AVAILABLE';
      } else if (idx === 0) {
        // First lesson is always available
        status = prog?.status ?? 'AVAILABLE';
      } else {
        // Check if previous lesson is passed
        const prevLesson = lessons?.[idx - 1];
        const prevProg = progressMap[prevLesson?.id ?? ''];
        if (prevProg?.status === 'PASSED') {
          status = prog?.status ?? 'AVAILABLE';
        } else if (prog?.status === 'PASSED') {
          status = 'PASSED';
        } else {
          status = prog?.status ?? 'LOCKED';
        }
      }

      // Check content readiness for placeholder status
      if (status === 'AVAILABLE' && !lesson?.flightSchoolReady) {
        status = 'PLACEHOLDER';
      }

      return {
        ...lesson,
        progress: prog ?? null,
        computedStatus: status,
      };
    });

    return NextResponse.json(lessonsWithStatus);
  } catch (error: any) {
    console.error('Lessons fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch lessons' }, { status: 500 });
  }
}
