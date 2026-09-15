'use server';

import { cookies } from 'next/headers';
import {
  getAuthCookieOptions,
  getBackendApiUrl,
  getClearAuthCookieOptions,
  getCurrentUser,
  getSessionToken,
  type AuthResult,
  type AuthUser,
} from '@/lib/auth';

export interface LoginActionResponse {
  success: boolean;
  user?: AuthUser;
  message?: string;
}

export async function loginAction(credentials: {
  identifier: string;
  password: string;
}): Promise<LoginActionResponse> {
  const { identifier, password } = credentials;

  if (!identifier?.trim() || !password) {
    return {
      success: false,
      message: 'Identifier and password are required',
    };
  }

  const backendUrl = getBackendApiUrl();
  let res: Response;
  try {
    res = await fetch(`${backendUrl}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ identifier: identifier.trim(), password }),
      cache: 'no-store',
    });
  } catch (err: unknown) {
    console.error('Login action backend connection failure:', err);
    return {
      success: false,
      message: 'Unable to connect to authentication server',
    };
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    return {
      success: false,
      message: data?.message || 'Invalid identifier or password',
    };
  }

  const accessToken = data?.accessToken;
  if (!accessToken) {
    return {
      success: false,
      message: 'Authentication response was missing token',
    };
  }

  // Set HTTP-only cookie in Next.js Server Action
  const cookieStore = await cookies();
  const maxAge = typeof data?.expiresIn === 'number' ? data.expiresIn : 900;
  const opts = getAuthCookieOptions(maxAge);
  cookieStore.set(opts.name, accessToken, {
    httpOnly: opts.httpOnly,
    sameSite: opts.sameSite,
    path: opts.path,
    maxAge: opts.maxAge,
    secure: opts.secure,
  });

  return {
    success: true,
    user: data.user as AuthUser,
  };
}

export async function logoutAction(): Promise<{ success: boolean; message: string }> {
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
    console.warn('Backend logout notification failed:', err);
  }

  const cookieStore = await cookies();
  const clearOpts = getClearAuthCookieOptions();
  cookieStore.set(clearOpts.name, '', {
    httpOnly: clearOpts.httpOnly,
    sameSite: clearOpts.sameSite,
    path: clearOpts.path,
    maxAge: 0,
    secure: clearOpts.secure,
  });

  return {
    success: true,
    message: 'Logged out successfully',
  };
}

export async function getSessionAction(): Promise<AuthResult> {
  return getCurrentUser();
}

export async function changePasswordAction(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const { currentPassword, newPassword } = payload;
  if (!currentPassword?.trim() || !newPassword?.trim()) {
    return { success: false, message: 'Current password and new password are required' };
  }

  if (newPassword.length < 8 || newPassword.length > 72) {
    return { success: false, message: 'New password must be between 8 and 72 characters' };
  }

  if (currentPassword === newPassword) {
    return { success: false, message: 'New password cannot be the same as current password' };
  }

  try {
    const token = await getSessionToken();
    if (!token) {
      return { success: false, message: 'Your session has expired. Please sign in again.' };
    }

    const backendUrl = getBackendApiUrl();
    const res = await fetch(`${backendUrl}/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        message: data?.message || 'Failed to change password. Please verify your current password.',
      };
    }

    return {
      success: true,
      message: 'Password changed successfully',
    };
  } catch (err: unknown) {
    console.error('Change password action error:', err);
    return {
      success: false,
      message: 'Unable to connect to authentication server',
    };
  }
}
