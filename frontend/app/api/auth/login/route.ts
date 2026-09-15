import { NextRequest, NextResponse } from 'next/server';
import {
  getAuthCookieOptions,
  getBackendApiUrl,
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

  // 2. Parse credentials
  let body: { identifier?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: 'Invalid JSON request body' },
      { status: 400 },
    );
  }

  const { identifier, password } = body;
  if (!identifier || !password) {
    return NextResponse.json(
      { success: false, message: 'Identifier and password are required' },
      { status: 400 },
    );
  }

  // 3. Call backend POST /auth/login
  const backendUrl = getBackendApiUrl();
  let backendRes: Response;
  try {
    backendRes = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier, password }),
      cache: 'no-store',
    });
  } catch (err: unknown) {
    console.error('Failed to reach backend during login:', err);
    return NextResponse.json(
      { success: false, message: 'Unable to connect to authentication server' },
      { status: 502 },
    );
  }

  const backendData = await backendRes.json().catch(() => null);

  if (!backendRes.ok) {
    return NextResponse.json(
      {
        success: false,
        message: backendData?.message || 'Invalid identifier or password',
      },
      { status: backendRes.status },
    );
  }

  const accessToken = backendData?.accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { success: false, message: 'Authentication response was missing token' },
      { status: 502 },
    );
  }

  // 4. Construct Next.js BFF response without exposing accessToken in JSON
  const response = NextResponse.json(
    {
      success: true,
      user: backendData.user,
    },
    { status: 200 },
  );

  // 5. Attach HTTP-only cookie to the Next.js response
  const maxAge = typeof backendData?.expiresIn === 'number' ? backendData.expiresIn : 900;
  const cookieOpts = getAuthCookieOptions(maxAge);
  response.cookies.set({
    name: cookieOpts.name,
    value: accessToken,
    httpOnly: cookieOpts.httpOnly,
    sameSite: cookieOpts.sameSite,
    path: cookieOpts.path,
    maxAge: cookieOpts.maxAge,
    secure: cookieOpts.secure,
  });

  return response;
}
