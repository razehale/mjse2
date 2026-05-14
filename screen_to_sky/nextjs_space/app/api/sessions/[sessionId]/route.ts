export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flightSession = await prisma.flightSession.findUnique({
      where: { id: params?.sessionId ?? '' },
      include: {
        scores: true,
        attempts: { orderBy: { startTime: 'asc' } },
        lesson: true,
      },
    });

    if (!flightSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const userId = (session?.user as any)?.id;
    const role = (session?.user as any)?.role;

    // START ST-900 Logic — Allow owner, admin, or instructor
    if (flightSession?.userId !== userId && role !== 'ADMIN' && role !== 'INSTRUCTOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json(flightSession);
  } catch (error: any) {
    console.error('Session fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}
