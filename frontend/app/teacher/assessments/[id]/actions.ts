"use server";

import { revalidatePath } from "next/cache";
import { authenticatedFetch } from "@/lib/auth";

export async function bulkPublishAttempts(
  assessmentId: string,
  attemptIds: string[]
) {
  const res = await authenticatedFetch(`/assessments/${assessmentId}/results/publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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
