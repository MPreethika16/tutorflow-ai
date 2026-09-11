"use server";

import { revalidatePath } from "next/cache";
import { authenticatedFetch } from "@/lib/auth";

export async function startAssessmentAction(assessmentId: string) {
  const response = await authenticatedFetch(`/student/assessments/${assessmentId}/start`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to start assessment");
  }

  const data = await response.json();
  revalidatePath("/student");
  return data;
}

export async function markNotificationReadAction(notificationId: string) {
  try {
    const response = await authenticatedFetch(`/notifications/${notificationId}/read`, {
      method: "PATCH",
    });
    // We intentionally don't throw if it fails, as per requirements:
    // "do not display a disruptive error. the notification may remain unread until the next refresh"
    if (response.ok) {
      // Revalidate to sync server state on next navigation
      revalidatePath("/student", "layout");
    }
  } catch (err) {
    console.error("Failed to mark notification as read", err);
  }
}
