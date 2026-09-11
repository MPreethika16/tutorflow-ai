import React from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { ServiceUnavailable } from '@/components/ui/ServiceUnavailable';
import { LogoutButton } from '@/components/layout/LogoutButton';
import { ChangePasswordForm } from './components/ChangePasswordForm';

export const metadata: Metadata = {
  title: 'Update Password — TutorFlow AI',
  description: 'Set a permanent password to access your student account.',
};

export default async function ChangePasswordPage() {
  const auth = await getCurrentUser();

  if (auth.status === 'unauthenticated') {
    redirect('/login?returnUrl=/change-password');
  }

  if (auth.status === 'error') {
    return (
      <ServiceUnavailable
        message="Unable to reach the TutorFlow authentication service. Please verify your connection or try again in a few moments."
      />
    );
  }

  // Teachers are never routed into this flow
  if (auth.user.role === 'TEACHER') {
    redirect('/teacher/assessments');
  }

  // If student has already changed password, route to standard dashboard
  if (auth.user.role === 'STUDENT' && !auth.user.mustChangePassword) {
    redirect('/student');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Minimal Top Header */}
      <header className="border-b border-border bg-surface/50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded flex items-center justify-center font-heading font-bold text-lg">
              T
            </div>
            <span className="font-heading font-semibold text-lg text-foreground tracking-tight">
              TutorFlow
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-foreground/60 hidden sm:inline">
              Student Account Setup
            </span>
            <LogoutButton variant="nav" />
          </div>
        </div>
      </header>

      {/* Main Focus Area */}
      <main className="flex-1 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-2">
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary mb-2">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-heading font-semibold text-foreground tracking-tight">
            Set Your Permanent Password
          </h1>
          <p className="text-sm text-foreground/70 max-w-sm mx-auto">
            Your teacher created your student profile with a temporary password.
            Please choose a secure personal password to activate your account.
          </p>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-surface py-8 px-6 sm:px-10 border border-border rounded-xl shadow-xs">
            <ChangePasswordForm />
          </div>

          <p className="mt-6 text-center text-xs text-foreground/50">
            TutorFlow Academic SaaS &middot; Secure Password Replacement
          </p>
        </div>
      </main>

      {/* Subtle Footer */}
      <footer className="py-4 text-center text-xs text-foreground/40 border-t border-border">
        &copy; {new Date().getFullYear()} TutorFlow AI. All rights reserved.
      </footer>
    </div>
  );
}
