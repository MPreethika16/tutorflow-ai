import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { StudentDashboardClient } from "./components/StudentDashboardClient";

async function fetchWithAuth(url: string) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

  try {
    const res = await fetch(url, {
      headers: {
        'Cookie': cookieHeader,
        'Cache-Control': 'no-cache', // Ensure fresh data
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { error: 'UNAUTHORIZED' };
      }
      if (res.status === 404) {
        return { error: 'NOT_FOUND' };
      }
      return { error: 'API_ERROR' };
    }

    const data = await res.json();
    return { data };
  } catch (error) {
    console.error(`Fetch error for ${url}:`, error);
    return { error: 'NETWORK_ERROR' };
  }
}

export default async function StudentDashboardPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const [assessmentsRes, attemptsRes] = await Promise.all([
    fetchWithAuth(`${apiUrl}/student/assessments`),
    fetchWithAuth(`${apiUrl}/student/attempts`)
  ]);

  if (assessmentsRes.error === 'UNAUTHORIZED' || attemptsRes.error === 'UNAUTHORIZED') {
    // In a real app we might redirect to login, for now just show a message or throw
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface border border-destructive/20 rounded-lg text-center space-y-4">
        <p className="text-foreground font-medium">Please sign in to view your dashboard.</p>
      </div>
    );
  }

  if (assessmentsRes.error || attemptsRes.error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface border border-destructive/20 rounded-lg shadow-sm text-center space-y-4">
        <p className="text-foreground font-medium">Unable to load dashboard data.</p>
        <p className="text-secondary-foreground text-sm">Please try again later or contact support if the issue persists.</p>
      </div>
    );
  }

  const availableAssessments = assessmentsRes.data?.assessments || [];
  const attemptHistory = attemptsRes.data?.attempts || [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-heading font-semibold text-foreground tracking-tight">
        My Assessments
      </h1>
      <StudentDashboardClient
        availableAssessments={availableAssessments}
        attemptHistory={attemptHistory}
      />
    </div>
  );
}
