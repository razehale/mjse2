import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { AdminClient } from './_components/admin-client';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  // START ST-900 Logic — Allow ADMIN + INSTRUCTOR
  const role = (session?.user as any)?.role;
  if (role !== 'ADMIN' && role !== 'INSTRUCTOR') redirect('/dashboard');
  // END ST-900 Logic
  return <AdminClient />;
}
