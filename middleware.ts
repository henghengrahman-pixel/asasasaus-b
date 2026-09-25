import {NextResponse} from 'next/server';import type {NextRequest} from 'next/server';
export function middleware(r:NextRequest){if(r.nextUrl.pathname.startsWith('/admin')&&r.nextUrl.pathname!='/admin/login'&&!r.cookies.get('jb_admin_session'))return NextResponse.redirect(new URL('/admin/login',r.url));return NextResponse.next()}
export const config={matcher:['/admin/:path*']};
