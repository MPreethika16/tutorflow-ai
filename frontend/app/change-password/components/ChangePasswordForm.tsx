'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changePasswordAction } from '@/app/auth/actions';

export function ChangePasswordForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Client-side validations aligned with 8-72 char backend constraint
    if (!currentPassword.trim()) {
      setError('Current password is required.');
      return;
    }

    if (!newPassword) {
      setError('New password is required.');
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 72) {
      setError('New password must be between 8 and 72 characters.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('New password cannot be the same as your temporary password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation password do not match.');
      return;
    }

    startTransition(async () => {
      try {
        const result = await changePasswordAction({
          currentPassword,
          newPassword,
        });

        if (!result.success) {
          setError(result.message || 'Failed to update password. Please check your current password.');
          return;
        }

        // Successfully updated password -> navigate to student dashboard
        router.push('/student');
        router.refresh();
      } catch (err: unknown) {
        console.error('Change password submission error:', err);
        setError('A network error occurred. Please check your connection and try again.');
      }
    });
  };

  const renderEyeIcon = (isVisible: boolean) =>
    isVisible ? (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
        />
      </svg>
    ) : (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
        />
      </svg>
    );

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={isPending} className="space-y-5">
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="p-3.5 rounded-md border text-sm flex items-start gap-2.5 bg-destructive/10 border-destructive/30 text-destructive"
        >
          <svg
            className="w-4 h-4 mt-0.5 shrink-0 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="leading-snug">{error}</span>
        </div>
      )}

      {/* Current Temporary Password */}
      <div className="space-y-1.5">
        <label
          htmlFor="currentPassword"
          className="block text-sm font-medium text-foreground"
        >
          Current (Temporary) Password
        </label>
        <div className="relative">
          <input
            id="currentPassword"
            name="currentPassword"
            type={showCurrentPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            disabled={isPending}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Enter temporary password"
            className="w-full pl-3.5 pr-11 py-2.5 bg-surface border border-border rounded-md text-foreground placeholder:text-foreground/40 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-colors disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowCurrentPassword(!showCurrentPassword)}
            disabled={isPending}
            aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground/50 hover:text-foreground focus:outline-none focus-visible:text-primary transition-colors cursor-pointer"
          >
            {renderEyeIcon(showCurrentPassword)}
          </button>
        </div>
        <p className="text-xs text-foreground/60">
          The temporary password provided by your teacher.
        </p>
      </div>

      {/* New Password */}
      <div className="space-y-1.5">
        <label
          htmlFor="newPassword"
          className="block text-sm font-medium text-foreground"
        >
          New Password
        </label>
        <div className="relative">
          <input
            id="newPassword"
            name="newPassword"
            type={showNewPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            disabled={isPending}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="At least 8 characters"
            className="w-full pl-3.5 pr-11 py-2.5 bg-surface border border-border rounded-md text-foreground placeholder:text-foreground/40 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-colors disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword(!showNewPassword)}
            disabled={isPending}
            aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground/50 hover:text-foreground focus:outline-none focus-visible:text-primary transition-colors cursor-pointer"
          >
            {renderEyeIcon(showNewPassword)}
          </button>
        </div>
        <p className="text-xs text-foreground/60">
          Must be between 8 and 72 characters in length.
        </p>
      </div>

      {/* Confirm New Password */}
      <div className="space-y-1.5">
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium text-foreground"
        >
          Confirm New Password
        </label>
        <div className="relative">
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            disabled={isPending}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter new password"
            className="w-full pl-3.5 pr-11 py-2.5 bg-surface border border-border rounded-md text-foreground placeholder:text-foreground/40 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent transition-colors disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            disabled={isPending}
            aria-label={showConfirmPassword ? 'Hide confirmation password' : 'Show confirmation password'}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-foreground/50 hover:text-foreground focus:outline-none focus-visible:text-primary transition-colors cursor-pointer"
          >
            {renderEyeIcon(showConfirmPassword)}
          </button>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-medium rounded-md text-sm hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center justify-center gap-2 cursor-pointer mt-2"
      >
        {isPending ? (
          <>
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
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
            <span>Updating password…</span>
          </>
        ) : (
          <span>Set New Password</span>
        )}
      </button>
    </form>
  );
}
