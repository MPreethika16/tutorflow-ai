"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function startAssessmentAction(assessmentId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");

  const response = await fetch(`${apiUrl}/student/assessments/${assessmentId}/start`, {
    method: "POST",
    headers: {
      "Cookie": cookieHeader,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to start assessment");
  }

  const data = await response.json();
  revalidatePath("/student");
  return data;
}

export async function markNotificationReadAction(notificationId: string) {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");

  try {
    const response = await fetch(`${apiUrl}/notifications/${notificationId}/read`, {
      method: "PATCH",
      headers: {
        "Cookie": cookieHeader,
      },
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
