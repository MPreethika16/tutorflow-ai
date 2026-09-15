'use client';

import React, { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginAction } from '@/app/auth/actions';
import { getSafeRedirectUrl } from '@/lib/auth-shared';

type RoleContext = 'TEACHER' | 'STUDENT';
type ErrorState = {
  kind: 'validation' | 'invalid_credentials' | 'service_unavailable';
  message: string;
} | null;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get('returnUrl');

  const [roleContext, setRoleContext] = useState<RoleContext>('TEACHER');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<ErrorState>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setError({
        kind: 'validation',
        message:
          roleContext === 'TEACHER'
            ? 'Please enter your educator email address.'
            : 'Please enter your Student ID.',
      });
      return;
    }

    if (!password) {
      setError({
        kind: 'validation',
        message: 'Please enter your account password.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const result = await loginAction({
          identifier: trimmedIdentifier,
          password,
        });

        if (!result.success || !result.user) {
          const msg = result.message?.toLowerCase() || '';
          if (
            msg.includes('unable to connect') ||
            msg.includes('network') ||
            msg.includes('unavailable') ||
            msg.includes('server')
          ) {
            setError({
              kind: 'service_unavailable',
              message:
                'The authentication service is temporarily unavailable. Please try again in a few moments.',
            });
          } else {
            setError({
              kind: 'invalid_credentials',
              message:
                'Invalid identifier or password. Please verify your details and try again.',
            });
          }
          return;
        }

        // Post-login routing using authoritative role returned by backend
        const destination =
          result.user.role === 'STUDENT' && result.user.mustChangePassword
            ? '/change-password'
            : getSafeRedirectUrl(returnUrl, result.user.role);
        router.push(destination);
        router.refresh();
      } catch (err: unknown) {
        console.error('Login submission error:', err);
        setError({
          kind: 'service_unavailable',
          message:
            'A connection error occurred. Please check your network and try again.',
        });
      }
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-busy={isPending}
      className="space-y-6"
    >
      {/* Role Context Selector */}
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-foreground/70">
          Account Type
        </label>
        <div
          role="tablist"
          aria-label="Select account type"
          className="grid grid-cols-2 p-1 bg-secondary/30 rounded-lg border border-border text-sm"
        >
          <button
            type="button"
            role="tab"
            aria-selected={roleContext === 'TEACHER'}
            onClick={() => {
              setRoleContext('TEACHER');
              setError(null);
            }}
            disabled={isPending}
            className={`py-2 px-3 rounded-md font-medium transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
              roleContext === 'TEACHER'
                ? 'bg-surface text-primary shadow-xs font-semibold'
                : 'text-foreground/70 hover:text-foreground hover:bg-surface/50'
            }`}
          >
            Teacher
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={roleContext === 'STUDENT'}
            onClick={() => {
              setRoleContext('STUDENT');
              setError(null);
            }}
            disabled={isPending}
            className={`py-2 px-3 rounded-md font-medium transition-all text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer ${
              roleContext === 'STUDENT'
                ? 'bg-surface text-primary shadow-xs font-semibold'
                : 'text-foreground/70 hover:text-foreground hover:bg-surface/50'
            }`}
          >
            Student
          </button>
        </div>
      </div>

      {/* Accessible Error Banner */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className={`p-3.5 rounded-md border text-sm flex items-start gap-2.5 transition-all ${
            error.kind === 'service_unavailable'
              ? 'bg-amber-50 border-warning/40 text-amber-900'
              : 'bg-red-50 border-error/30 text-error'
          }`}
        >
          <svg
            className="w-5 h-5 shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="leading-snug">{error.message}</span>
        </div>
      )}

      {/* Identifier Input */}
      <div className="space-y-1.5">
        <label
          htmlFor="identifier"
          className="block text-sm font-medium text-foreground"
        >
          {roleContext === 'TEACHER' ? 'Email Address' : 'Student ID'}
        </label>
        <input
          id="identifier"
          name="identifier"
          type={roleContext === 'TEACHER' ? 'email' : 'text'}
          autoComplete="username"
          required
          disabled={isPending}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={
            roleContext === 'TEACHER'
              ? 'name@institution.edu'
              : 'e.g. STU-10492'
          }
          aria-describedby="identifier-help"
          className="w-full px-3.5 py-2.5 bg-surface border border-border rounded-md text-foreground placeholder:text-foreground/40 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-colors disabled:opacity-50"
        />
        <p id="identifier-help" className="text-xs text-foreground/60">
          {roleContext === 'TEACHER'
            ? 'Sign in with your registered educator email address.'
            : 'Use the unique Student ID supplied by your teacher.'}
        </p>
      </div>

      {/* Password Input with Accessible Show/Hide Toggle */}
      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-sm font-medium text-foreground"
        >
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={isPending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full pl-3.5 pr-11 py-2.5 bg-surface border border-border rounded-md text-foreground placeholder:text-foreground/40 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-colors disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            disabled={isPending}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground/50 hover:text-foreground focus:outline-none focus-visible:text-primary transition-colors cursor-pointer"
          >
            {showPassword ? (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                />
              </svg>
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full flex items-center justify-center py-2.5 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs cursor-pointer"
      >
        {isPending ? (
          <span className="inline-flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4 text-primary-foreground"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>Signing in…</span>
          </span>
        ) : (
          <span>Sign In</span>
        )}
      </button>
    </form>
  );
}
