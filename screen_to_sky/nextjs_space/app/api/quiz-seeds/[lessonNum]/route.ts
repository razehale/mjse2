// START ST-802D Logic — Quiz Seeds API (load questions)
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getQuizSeeds } from '@/lib/s2s-engine/quiz';

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
    if (!lessonNum || isNaN(lessonNum)) {
      return NextResponse.json({ error: 'Invalid lesson number' }, { status: 400 });
    }

    const seeds = await getQuizSeeds(lessonNum);
    // Strip correctIndex and explanation for student-facing load
    const questions = seeds.map((s) => ({
      id: s.id,
      question: s.question,
      options: s.options,
    }));

    return NextResponse.json({ lessonNum, questions, totalCount: questions.length });
  } catch (error: any) {
    console.error('Quiz seeds fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 });
  }
}
// END ST-802D Logic
