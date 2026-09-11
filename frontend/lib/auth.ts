import { cookies } from 'next/headers';

export * from './auth-shared';

export const SESSION_COOKIE_NAME = 'access_token';

import type { AuthResult, AuthUser } from './auth-shared';

/**
 * Returns the backend API base URL with server/client env fallback.
 */
export function getBackendApiUrl(): string {
  return (
    process.env.BACKEND_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000'
  ).replace(/\/+$/, '');
}

/**
 * Cookie options for setting the access_token.
 * Aligned with backend JWT expiry (default 900 seconds / 15 minutes).
 */
export function getAuthCookieOptions(maxAgeSeconds = 900) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
    secure: isProduction,
  };
}

/**
 * Cookie options for clearing the access_token.
 */
export function getClearAuthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
    secure: isProduction,
  };
}

/**
 * Reads the session token from cookies on the server side only.
 */
export async function getSessionToken(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE_NAME)?.value;
  } catch {
    return undefined;
  }
}

/**
 * Resolves the authenticated user by querying the backend GET /auth/me endpoint.
 *
 * Rules:
 * - Does NOT decode JWT claims as authoritative identity.
 * - Distinguishes unauthenticated (401/403/missing token) from network/server errors.
 * - Forces cache: 'no-store' to prevent caching across users.
 */
export async function getCurrentUser(): Promise<AuthResult> {
  const token = await getSessionToken();
  if (!token) {
    return { status: 'unauthenticated' };
  }

  const backendUrl = getBackendApiUrl();

  try {
    const res = await fetch(`${backendUrl}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403) {
      return { status: 'unauthenticated' };
    }

    if (!res.ok) {
      return {
        status: 'error',
        error: 'SERVER_ERROR',
        statusCode: res.status,
        message: `Backend returned HTTP ${res.status}`,
      };
    }

    const payload = await res.json();
    return {
      status: 'authenticated',
      user: payload as AuthUser,
    };
  } catch (err: unknown) {
    return {
      status: 'error',
      error: 'NETWORK_ERROR',
      message: err instanceof Error ? err.message : 'Network failure',
    };
  }
}

/**
 * Server-side authenticated API fetch helper.
 *
 * - Resolves full backend URL for relative paths.
 * - Attaches session token as `Authorization: Bearer <token>`.
 * - Does NOT forward unrelated browser cookies.
 * - Enforces `cache: 'no-store'` by default to prevent cross-user caching.
 */
export async function authenticatedFetch(
  pathOrUrl: string,
  init: RequestInit = {},
): Promise<Response> {
  const backendUrl = getBackendApiUrl();
  const url = pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')
    ? pathOrUrl
    : `${backendUrl}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

  const headers = new Headers(init.headers);

  // Read access_token and forward as Bearer token
  const token = await getSessionToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...init,
    headers,
    cache: init.cache ?? 'no-store',
  });
}

/**
 * Validates that a state-changing browser request originates from the same origin.
 * Protects BFF endpoints against CSRF and cross-origin invocation.
 */
export function validateSameOrigin(request: Request): boolean {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) {
    return false;
  }

  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      return originUrl.host === host;
    } catch {
      return false;
    }
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererUrl = new URL(referer);
      return refererUrl.host === host;
    } catch {
      return false;
    }
  }

  // State-changing requests without Origin or Referer header are rejected
  return false;
}
