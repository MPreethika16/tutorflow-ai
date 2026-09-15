import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUser, evaluateProtectedAccess } from '@/lib/auth';
import { ServiceUnavailable } from '@/components/ui/ServiceUnavailable';
import { TeacherHeader } from './components/TeacherHeader';

export default async function TeacherLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getCurrentUser();
  const decision = evaluateProtectedAccess(auth, 'TEACHER', '/teacher/assessments');

  if (decision.action === 'redirect') {
    redirect(decision.destination);
  }

  if (decision.action === 'service_unavailable') {
    return (
      <ServiceUnavailable
        message="Unable to reach the TutorFlow authentication service. Please verify your connection or try again in a few moments."
      />
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TeacherHeader user={decision.user} />
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  );
}
