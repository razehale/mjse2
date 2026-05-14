// START ST-900 Logic — Gradebook Page (server guard)
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { GradebookClient } from './_components/gradebook-client';

export const dynamic = 'force-dynamic';

export default async function GradebookPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  const role = (session?.user as any)?.role;
  if (role !== 'ADMIN' && role !== 'INSTRUCTOR') redirect('/dashboard');
  return <GradebookClient />;
}
// END ST-900 Logic
