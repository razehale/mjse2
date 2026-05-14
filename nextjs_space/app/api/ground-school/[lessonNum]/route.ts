// START ST-802C Logic — Ground School API
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getGroundSchoolContent } from '@/lib/s2s-engine/ground-school';

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

    const content = await getGroundSchoolContent(lessonNum);
    if (!content) {
      return NextResponse.json({ error: 'Ground school content not found' }, { status: 404 });
    }

    return NextResponse.json(content);
  } catch (error: any) {
    console.error('Ground school fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}
// END ST-802C Logic
