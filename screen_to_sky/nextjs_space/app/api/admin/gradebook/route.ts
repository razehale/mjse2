// START ST-900 Logic — Gradebook API: enriched student data
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user || (role !== 'ADMIN' && role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        progress: {
          include: {
            lesson: { select: { lessonNum: true, title: true, arcNum: true } },
          },
        },
        sessions: {
          select: {
            id: true,
            uploadTimestamp: true,
            csvFilename: true,
            durationSec: true,
            parsedData: true,
            lessonId: true,
            lesson: { select: { lessonNum: true, title: true, arcNum: true } },
            scores: { select: { overallScore: true, breakdown: true, createdAt: true } },
            attempts: { select: { segmentType: true, metrics: true, confidence: true }, orderBy: { startTime: 'asc' } },
          },
          orderBy: { uploadTimestamp: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Compute enriched fields
    const enriched = (students ?? []).map((student: any) => {
      const progressList = student?.progress ?? [];
      const sessionList = student?.sessions ?? [];

      // Current lesson = lowest lessonNum not PASSED
      const passedLessonNums = progressList
        .filter((p: any) => p?.status === 'PASSED')
        .map((p: any) => p?.lesson?.lessonNum ?? 0);
      const allLessonNums = progressList.map((p: any) => p?.lesson?.lessonNum ?? 0);
      const maxPassed = passedLessonNums.length > 0 ? Math.max(...passedLessonNums) : 0;
      const currentLesson = maxPassed + 1;

      // Avg flight score from progress records (1-5 scale)
      const scoredProgress = progressList.filter((p: any) => p?.flightScore != null && p?.flightScore > 0);
      const avgFlightScore = scoredProgress.length > 0
        ? Math.round((scoredProgress.reduce((sum: number, p: any) => sum + (p?.flightScore ?? 0), 0) / scoredProgress.length) * 10) / 10
        : null;

      // Last flight date
      const lastFlightDate = sessionList.length > 0 ? sessionList[0]?.uploadTimestamp : null;

      // Status: active if flight in last 14 days, idle if 14-30, inactive if >30
      let activityStatus = 'NEW';
      if (lastFlightDate) {
        const daysSince = Math.floor((Date.now() - new Date(lastFlightDate).getTime()) / (1000 * 60 * 60 * 24));
        if (daysSince <= 14) activityStatus = 'ACTIVE';
        else if (daysSince <= 30) activityStatus = 'IDLE';
        else activityStatus = 'INACTIVE';
      }

      const passedCount = passedLessonNums.length;

      return {
        id: student?.id,
        email: student?.email,
        name: student?.name,
        createdAt: student?.createdAt,
        currentLesson,
        avgFlightScore,
        lastFlightDate,
        activityStatus,
        passedCount,
        progress: progressList,
        sessions: sessionList,
      };
    });

    return NextResponse.json(enriched ?? []);
  } catch (error: any) {
    console.error('Gradebook API error:', error);
    return NextResponse.json({ error: 'Failed to fetch gradebook data' }, { status: 500 });
  }
}
// END ST-900 Logic
