'use client';

import React from 'react';
import Link from 'next/link';

interface ServiceUnavailableProps {
  title?: string;
  message?: string;
}

export function ServiceUnavailable({
  title = 'Service Temporarily Unavailable',
  message = 'We are currently unable to reach the TutorFlow authentication service. Your session and work remain secure. Please try refreshing in a moment.',
}: ServiceUnavailableProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-foreground">
      <div className="w-full max-w-md bg-surface border border-border rounded-lg p-8 shadow-sm text-center space-y-6">
        <div className="w-12 h-12 rounded-full bg-secondary/50 border border-secondary text-primary mx-auto flex items-center justify-center">
          <svg
            className="w-6 h-6 text-primary"
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
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-heading font-semibold text-primary tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-foreground/80 leading-relaxed">
            {message}
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors cursor-pointer"
          >
            Try Again
          </button>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2.5 bg-secondary text-secondary-foreground text-sm font-medium rounded-md hover:bg-secondary-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
