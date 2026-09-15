'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { AuthUser } from '@/lib/auth';
import { LogoutButton } from '@/components/layout/LogoutButton';
import {
  StudentNotificationBell,
  type Notification,
} from './StudentNotificationBell';

interface StudentHeaderProps {
  user: AuthUser;
  notifications: Notification[];
}

export function StudentHeader({ user, notifications }: StudentHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isHomeActive = pathname === '/student';

  return (
    <header className="bg-surface border-b border-border sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Brand & Navigation */}
          <div className="flex items-center gap-8">
            <Link
              href="/student"
              className="flex items-center gap-2.5 group focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
            >
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-md flex items-center justify-center font-heading font-bold text-lg shadow-xs">
                T
              </div>
              <div className="flex flex-col">
                <span className="font-heading font-semibold text-lg text-primary tracking-tight leading-none group-hover:text-primary-hover transition-colors">
                  TutorFlow
                </span>
                <span className="text-[10px] uppercase font-semibold tracking-wider text-foreground/50">
                  Student Portal
                </span>
              </div>
            </Link>

            <nav
              className="hidden md:flex items-center gap-1"
              aria-label="Student navigation"
            >
              <Link
                href="/student"
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isHomeActive
                    ? 'bg-secondary/40 text-primary font-semibold'
                    : 'text-foreground/70 hover:text-foreground hover:bg-secondary/20'
                }`}
              >
                My Assessments
              </Link>
            </nav>
          </div>

          {/* Desktop User Info, Notifications & Logout */}
          <div className="hidden md:flex items-center gap-4">
            <StudentNotificationBell initialNotifications={notifications} />

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground border border-border flex items-center justify-center font-semibold text-xs">
                {user.firstName[0]?.toUpperCase()}
                {user.lastName[0]?.toUpperCase()}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-sm font-medium text-foreground leading-tight">
                  {user.firstName} {user.lastName}
                </span>
                <span className="text-[11px] text-foreground/50 font-normal">
                  Student
                </span>
              </div>
            </div>

            <div className="h-4 w-px bg-border mx-1" aria-hidden="true" />

            <LogoutButton variant="nav" />
          </div>

          {/* Mobile Actions & Menu Toggle */}
          <div className="flex md:hidden items-center gap-2">
            <StudentNotificationBell initialNotifications={notifications} />

            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="p-2 rounded-md text-foreground/70 hover:text-foreground hover:bg-secondary/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {mobileMenuOpen ? (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border py-4 px-2 space-y-4">
            <nav className="space-y-1" aria-label="Mobile student navigation">
              <Link
                href="/student"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium transition-colors ${
                  isHomeActive
                    ? 'bg-secondary/40 text-primary font-semibold'
                    : 'text-foreground/70 hover:text-foreground hover:bg-secondary/20'
                }`}
              >
                My Assessments
              </Link>
            </nav>

            <div className="border-t border-border pt-4 flex items-center justify-between px-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-secondary text-secondary-foreground border border-border flex items-center justify-center font-semibold text-sm">
                  {user.firstName[0]?.toUpperCase()}
                  {user.lastName[0]?.toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {user.firstName} {user.lastName}
                  </div>
                  <div className="text-xs text-foreground/50">Student</div>
                </div>
              </div>
              <LogoutButton variant="compact" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
