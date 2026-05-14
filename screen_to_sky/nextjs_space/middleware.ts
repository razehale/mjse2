import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req: any) {
    const token = req?.nextauth?.token;
    const { pathname } = req?.nextUrl ?? {};

    // START ST-900 Logic — Admin/Instructor routes
    const isPrivileged = token?.role === 'ADMIN' || token?.role === 'INSTRUCTOR';
    if (pathname?.startsWith?.('/admin') && !isPrivileged) {
      return NextResponse.redirect(new URL('/dashboard', req?.url));
    }
    // END ST-900 Logic

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }: any) => !!token,
    },
  }
);

export const config = {
  matcher: ['/dashboard/:path*', '/lesson/:path*', '/admin/:path*'],
};
