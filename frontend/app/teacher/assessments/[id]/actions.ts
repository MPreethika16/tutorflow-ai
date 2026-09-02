"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function bulkPublishAttempts(
  assessmentId: string,
  attemptIds: string[]
) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const res = await fetch(`${apiUrl}/assessments/${assessmentId}/results/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cookie": cookieHeader,
    },
    body: JSON.stringify({ attemptIds }),
  });

  if (!res.ok) {
    return { success: false, status: res.status };
  }

  const data = await res.json();

  // Refresh the assessment list page
  revalidatePath(`/teacher/assessments/${assessmentId}`);
  // Also refresh any review pages for these attempts just in case
  attemptIds.forEach(id => {
    revalidatePath(`/teacher/assessments/${assessmentId}/attempts/${id}`);
  });

  return { success: true, data };
}
