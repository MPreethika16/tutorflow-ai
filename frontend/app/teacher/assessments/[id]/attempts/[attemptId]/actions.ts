"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function approveAnswer(
  assessmentId: string,
  attemptId: string,
  answerId: string,
  teacherMarks?: number | null,
  teacherFeedback?: string | null
) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const res = await fetch(`${apiUrl}/assessments/${assessmentId}/attempts/${attemptId}/answers/${answerId}/review`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
    },
    body: JSON.stringify({
      teacherMarks,
      teacherFeedback
    })
  });

  if (!res.ok) {
    // Return explicit error objects based on status codes
    if (res.status === 409) {
      revalidatePath(`/teacher/assessments/${assessmentId}/attempts/${attemptId}`);
      return { success: false, error: 'CONFLICT', status: res.status };
    }
    if (res.status === 400) {
      return { success: false, error: 'VALIDATION', status: res.status };
    }
    if (res.status === 401 || res.status === 403) {
      return { success: false, error: 'UNAUTHORIZED', status: res.status };
    }
    return { success: false, error: 'NETWORK', status: res.status };
  }

  // Safely refresh the route to pull the latest state
  revalidatePath(`/teacher/assessments/${assessmentId}/attempts/${attemptId}`);

  return { success: true };
}

export async function publishAttempt(
  assessmentId: string,
  attemptId: string
) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const res = await fetch(`${apiUrl}/assessments/${assessmentId}/attempts/${attemptId}/publish`, {
    method: "POST",
    headers: {
      "Cookie": cookieHeader,
    }
  });

  if (!res.ok) {
    if (res.status === 409) {
      revalidatePath(`/teacher/assessments/${assessmentId}/attempts/${attemptId}`);
      revalidatePath(`/teacher/assessments/${assessmentId}`);
      return { success: false, error: 'CONFLICT', status: res.status };
    }
    if (res.status === 401 || res.status === 403) {
      return { success: false, error: 'UNAUTHORIZED', status: res.status };
    }
    return { success: false, error: 'NETWORK', status: res.status };
  }

  // Refresh both the attempt review page and the assessment list page
  revalidatePath(`/teacher/assessments/${assessmentId}/attempts/${attemptId}`);
  revalidatePath(`/teacher/assessments/${assessmentId}`);

  return { success: true };
}
