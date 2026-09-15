import { NextRequest, NextResponse } from 'next/server';
import {
  getBackendApiUrl,
  getClearAuthCookieOptions,
  getSessionToken,
  validateSameOrigin,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  // 1. Same-origin validation for state-changing requests
  if (!validateSameOrigin(request)) {
    return NextResponse.json(
      { success: false, message: 'Cross-origin requests are forbidden' },
      { status: 403 },
    );
  }

  // 2. Best-effort notify backend logout endpoint
  try {
    const token = await getSessionToken();
    const backendUrl = getBackendApiUrl();
    await fetch(`${backendUrl}/auth/logout`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: 'no-store',
    });
  } catch (err: unknown) {
    // Non-blocking: logout terminates local browser session regardless of backend network state
    console.warn('Backend logout notification failed:', err);
  }

  // 3. Clear the Next.js session cookie
  const response = NextResponse.json(
    {
      success: true,
      message: 'Logged out successfully',
    },
    { status: 200 },
  );

  const clearOpts = getClearAuthCookieOptions();
  response.cookies.set({
    name: clearOpts.name,
    value: '',
    httpOnly: clearOpts.httpOnly,
    sameSite: clearOpts.sameSite,
    path: clearOpts.path,
    maxAge: 0,
    secure: clearOpts.secure,
  });

  return response;
}
