import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { LessonClient } from './_components/lesson-client';

export const dynamic = 'force-dynamic';

export default async function LessonPage({ params }: { params: { lessonNum: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect('/login');
  }
  return <LessonClient lessonNum={params?.lessonNum ?? '1'} />;
}
