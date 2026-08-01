import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Single landing point for email confirmation, password recovery and OAuth.
 * Supabase sends a one-time code here; we trade it for a session cookie.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');
  const nextParam = searchParams.get('next');
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');

  // Only same-origin paths survive: an attacker-supplied absolute URL here
  // would turn our own domain into a redirect for their phishing page.
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/dashboard';

  if (providerError) {
    const url = new URL('/auth/auth-error', origin);
    url.searchParams.set('reason', 'provider');
    return NextResponse.redirect(url);
  }

  if (!code) {
    const url = new URL('/auth/auth-error', origin);
    url.searchParams.set('reason', 'missing');
    return NextResponse.redirect(url);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const url = new URL('/auth/auth-error', origin);
    url.searchParams.set('reason', 'expired');
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(new URL(next, origin));
}
