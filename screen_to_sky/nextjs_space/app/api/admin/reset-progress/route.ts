// START ST-900 Logic — Reset student lesson progress
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    if (!session?.user || (role !== 'ADMIN' && role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { userId, lessonId } = body ?? {};

    if (!userId || !lessonId) {
      return NextResponse.json({ error: 'userId and lessonId required' }, { status: 400 });
    }

    // Delete the progress record entirely — resets to LOCKED
    await prisma.userProgress.deleteMany({
      where: { userId, lessonId },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Reset progress error:', error);
    return NextResponse.json({ error: 'Failed to reset progress' }, { status: 500 });
  }
}
// END ST-900 Logic
