export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    // START ST-900 Logic — Allow ADMIN + INSTRUCTOR
    const role = (session?.user as any)?.role;
    if (!session?.user || (role !== 'ADMIN' && role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // END ST-900 Logic

    const students = await prisma.user.findMany({
      where: { role: 'STUDENT' },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        progress: {
          include: { lesson: { select: { lessonNum: true, title: true } } },
        },
        sessions: {
          select: { id: true, uploadTimestamp: true, csvFilename: true },
          orderBy: { uploadTimestamp: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(students ?? []);
  } catch (error: any) {
    console.error('Admin students error:', error);
    return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 });
  }
}
