'use client';

import { SessionProvider } from 'next-auth/react';
// START ST-900 Logic — Shadow Mode Provider
import { ShadowProvider } from '@/lib/shadow-context';
import { AdminShadowBar } from '@/components/admin-shadow-bar';
// END ST-900 Logic

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* START ST-900 Logic */}
      <ShadowProvider>
        <AdminShadowBar />
        {children}
      </ShadowProvider>
      {/* END ST-900 Logic */}
    </SessionProvider>
  );
}
