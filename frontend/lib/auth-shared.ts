export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  role: 'TEACHER' | 'STUDENT';
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  mustChangePassword?: boolean;
}

export type AuthResult =
  | { status: 'authenticated'; user: AuthUser }
  | { status: 'unauthenticated' }
  | { status: 'error'; error: 'NETWORK_ERROR' | 'SERVER_ERROR'; message?: string; statusCode?: number };

export type ProtectedAccessDecision =
  | { action: 'allow'; user: AuthUser }
  | { action: 'redirect'; destination: string }
  | { action: 'service_unavailable'; error: 'NETWORK_ERROR' | 'SERVER_ERROR'; message?: string };

/**
 * Safely resolves a post-login redirect URL based on authoritative user role.
 * - Only relative paths starting with a single '/' are allowed.
 * - Disallows external schemes, protocol-relative '//', backslashes, control chars.
 * - Enforces role boundary:
 *     TEACHER can only redirect to /teacher/* paths.
 *     STUDENT can only redirect to /student/* paths.
 * - Falls back to role default home (/teacher/assessments or /student).
 */
export function getSafeRedirectUrl(
  returnUrl: string | null | undefined,
  role: 'TEACHER' | 'STUDENT',
): string {
  const defaultUrl = role === 'TEACHER' ? '/teacher/assessments' : '/student';
  if (!returnUrl) {
    return defaultUrl;
  }

  // Must start with single slash, no double slashes, no backslashes
  if (!returnUrl.startsWith('/') || returnUrl.startsWith('//') || returnUrl.includes('\\')) {
    return defaultUrl;
  }

  try {
    const parsed = new URL(returnUrl, 'http://localhost');
    const path = parsed.pathname;

    if (role === 'TEACHER' && path.startsWith('/teacher')) {
      return `${path}${parsed.search}${parsed.hash}`;
    }
    if (role === 'STUDENT' && path.startsWith('/student')) {
      return `${path}${parsed.search}${parsed.hash}`;
    }
    return defaultUrl;
  } catch {
    return defaultUrl;
  }
}

/**
 * Pure evaluation function for protected route boundaries.
 * Enforces:
 * - Unauthenticated -> redirect to login with safe returnUrl
 * - Auth network/server error -> service_unavailable
 * - Wrong role -> redirect to authoritative role home
 * - Correct role -> allow
 */
export function evaluateProtectedAccess(
  auth: AuthResult,
  requiredRole: 'TEACHER' | 'STUDENT',
  requestedPath: string,
): ProtectedAccessDecision {
  if (auth.status === 'unauthenticated') {
    const safeReturn = requestedPath.startsWith('/') && !requestedPath.startsWith('//')
      ? requestedPath
      : (requiredRole === 'TEACHER' ? '/teacher/assessments' : '/student');
    return {
      action: 'redirect',
      destination: `/login?returnUrl=${encodeURIComponent(safeReturn)}`,
    };
  }

  if (auth.status === 'error') {
    return {
      action: 'service_unavailable',
      error: auth.error,
      message: auth.message,
    };
  }

  if (auth.user.role !== requiredRole) {
    // Cross-role boundary rejection
    const fallbackDestination = auth.user.role === 'TEACHER' ? '/teacher/assessments' : '/student';
    return {
      action: 'redirect',
      destination: fallbackDestination,
    };
  }

  if (auth.user.role === 'STUDENT' && auth.user.mustChangePassword) {
    return {
      action: 'redirect',
      destination: '/change-password',
    };
  }

  return {
    action: 'allow',
    user: auth.user,
  };
}
