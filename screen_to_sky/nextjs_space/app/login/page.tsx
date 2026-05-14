import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { redirect } from 'next/navigation';
import { LoginForm } from './_components/login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect('/dashboard');
  }
  return <LoginForm />;
}
