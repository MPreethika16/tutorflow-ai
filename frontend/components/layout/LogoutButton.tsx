'use client';

import React, { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logoutAction } from '@/app/auth/actions';

interface LogoutButtonProps {
  className?: string;
  variant?: 'nav' | 'compact' | 'danger';
}

export function LogoutButton({ className = '', variant = 'nav' }: LogoutButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    if (isPending) return;
    startTransition(async () => {
      try {
        await logoutAction();
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        router.push('/login');
        router.refresh();
      }
    });
  };

  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm';

  const variantStyles = {
    nav: 'text-foreground/70 hover:text-foreground hover:bg-secondary/40 px-3 py-1.5',
    compact: 'text-foreground/70 hover:text-foreground p-1.5',
    danger: 'text-error hover:bg-error/10 px-3 py-1.5',
  }[variant];

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      aria-busy={isPending}
      aria-label="Sign out of TutorFlow"
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      {isPending ? (
        <span className="inline-flex items-center gap-1.5">
          <svg
            className="animate-spin h-3.5 w-3.5 text-current"
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
          <span>Signing out…</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5">
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
              strokeWidth={1.75}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          <span>Sign Out</span>
        </span>
      )}
    </button>
  );
}
