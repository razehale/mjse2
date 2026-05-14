export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // START ST-900 Logic — Allow ADMIN + INSTRUCTOR
    const role = (session?.user as any)?.role;
    if (!session?.user || (role !== 'ADMIN' && role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // END ST-900 Logic

    const body = await req.json();
    const { userId, lessonId } = body ?? {};

    if (!userId || !lessonId) {
      return NextResponse.json({ error: 'userId and lessonId required' }, { status: 400 });
    }

    await prisma.userProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      update: {
        flightScore: 5,
        quizPassed: true,
        debriefViewed: true,
        status: 'PASSED',
        completedAt: new Date(),
      },
      create: {
        userId,
        lessonId,
        flightScore: 5,
        quizPassed: true,
        debriefViewed: true,
        status: 'PASSED',
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Force complete error:', error);
    return NextResponse.json({ error: 'Failed to force complete' }, { status: 500 });
  }
}
