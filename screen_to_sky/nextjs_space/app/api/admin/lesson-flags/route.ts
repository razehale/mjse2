export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    // START ST-900 Logic — Allow ADMIN + INSTRUCTOR
    const role = (session?.user as any)?.role;
    if (!session?.user || (role !== 'ADMIN' && role !== 'INSTRUCTOR')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // END ST-900 Logic

    const body = await req.json();
    const { lessonId, flags } = body ?? {};

    if (!lessonId || !flags) {
      return NextResponse.json({ error: 'lessonId and flags required' }, { status: 400 });
    }

    const updateData: any = {};
    const validFlags = ['flightSchoolReady', 'groundSchoolReady', 'quizReady', 'scoringReady', 'mediaReady'];
    for (const key of validFlags) {
      if (flags[key] !== undefined) {
        updateData[key] = !!flags[key];
      }
    }

    const lesson = await prisma.lesson.update({
      where: { id: lessonId },
      data: updateData,
    });

    return NextResponse.json(lesson);
  } catch (error: any) {
    console.error('Lesson flags error:', error);
    return NextResponse.json({ error: 'Failed to update flags' }, { status: 500 });
  }
}
