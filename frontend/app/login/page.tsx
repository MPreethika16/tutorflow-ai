import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from './components/LoginForm';

export const metadata: Metadata = {
  title: 'Sign In — TutorFlow AI',
  description: 'Sign in to access TutorFlow assessments and student feedback.',
};

export default async function LoginPage() {
  const auth = await getCurrentUser();

  // If already authenticated, redirect to the authoritative role default
  if (auth.status === 'authenticated') {
    if (auth.user.role === 'STUDENT' && auth.user.mustChangePassword) {
      redirect('/change-password');
    }
    const destination =
      auth.user.role === 'TEACHER' ? '/teacher/assessments' : '/student';
    redirect(destination);
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center space-y-3 px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-lg font-heading font-bold text-2xl shadow-xs mx-auto">
          T
        </div>
        <h1 className="text-3xl font-heading font-semibold text-primary tracking-tight">
          TutorFlow
        </h1>
        <p className="text-sm text-foreground/70 max-w-xs mx-auto">
          AI-assisted assessment & scholarly feedback for educators and students.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-surface py-8 px-6 sm:px-10 border border-border rounded-xl shadow-sm">
          <Suspense
            fallback={
              <div className="py-12 text-center text-sm text-foreground/50">
                Loading sign in form…
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>

        <p className="mt-6 text-center text-xs text-foreground/50">
          TutorFlow Academic SaaS &middot; Secure Same-Origin Session
        </p>
      </div>
    </div>
  );
}
