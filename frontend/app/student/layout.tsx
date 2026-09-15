import React from "react";
import { redirect } from "next/navigation";
import { getCurrentUser, evaluateProtectedAccess, authenticatedFetch } from "@/lib/auth";
import { ServiceUnavailable } from "@/components/ui/ServiceUnavailable";
import type { Notification } from "./components/StudentNotificationBell";
import { StudentHeader } from "./components/StudentHeader";

async function getNotifications(): Promise<Notification[]> {
  try {
    const res = await authenticatedFetch("/notifications");

    if (res.ok) {
      return await res.json();
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return [];
  }
}

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getCurrentUser();
  const decision = evaluateProtectedAccess(auth, 'STUDENT', '/student');

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

  const notifications = await getNotifications();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <StudentHeader user={decision.user} notifications={notifications} />
      <main className="flex-1 w-full max-w-4xl mx-auto p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
