import * as React from "react";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { AssessmentTabs } from "./components/AssessmentTabs";

// Helper to fetch data with auth headers
async function fetchWithAuth(url: string) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

  const res = await fetch(url, {
    cache: 'no-store',
    headers: { 'Cookie': cookieHeader }
  });

  if (res.status === 404 || res.status === 403) {
    return { error: 'NOT_FOUND', status: res.status };
  }

  if (!res.ok) {
    return { error: 'API_ERROR', status: res.status };
  }

  const data = await res.json();
  return { data };
}

export default async function AssessmentDetailPage({ params }: { params: { id: string } }) {
  const { id } = await params; // Note: In Next 15+ params is a Promise
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const [assessmentRes, attemptsRes, analyticsRes] = await Promise.all([
    fetchWithAuth(`${apiUrl}/assessments/${id}`),
    fetchWithAuth(`${apiUrl}/assessments/${id}/attempts`),
    fetchWithAuth(`${apiUrl}/assessments/${id}/analytics`)
  ]);

  if (assessmentRes.error === 'NOT_FOUND') {
    notFound();
  }

  if (assessmentRes.error === 'API_ERROR' || attemptsRes.error === 'API_ERROR' || analyticsRes.error === 'API_ERROR') {
    return (
      <main className="max-w-6xl mx-auto p-8">
        <div className="flex flex-col items-center justify-center p-12 bg-surface border border-destructive/20 rounded-lg shadow-sm text-center space-y-4">
          <p className="text-foreground font-medium">Unable to load assessment data.</p>
          <p className="text-secondary-foreground text-sm">Please try again later or contact support if the issue persists.</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </main>
    );
  }

  const assessment = assessmentRes.data;
  const attempts = attemptsRes.data || [];
  const analytics = analyticsRes.data;

  // Compute operational summary metrics without making additional requests
  const totalAttempts = attempts.length;
  const needsReview = attempts.filter((a: any) => a.derivedStatus === 'WAITING_FOR_REVIEW' || a.derivedStatus === 'FAILED').length;
  const readyToPublish = attempts.filter((a: any) => a.derivedStatus === 'READY_TO_PUBLISH').length;
  const published = attempts.filter((a: any) => a.derivedStatus === 'PUBLISHED').length;
  const grading = attempts.filter((a: any) => a.derivedStatus === 'GRADING').length;

  return (
    <main className="max-w-6xl mx-auto p-8 space-y-8">
      {/* 2. Page Header */}
      <div className="space-y-4">
        <nav className="text-sm font-medium text-secondary-foreground mb-4">
          <Link href="/teacher/assessments" className="hover:text-primary transition-colors">Assessments</Link>
          <span className="mx-2 opacity-50">/</span>
          <span className="text-foreground">{assessment.title}</span>
        </nav>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 gap-4">
          <div>
            <h1 className="text-3xl font-heading text-primary tracking-tight">{assessment.title}</h1>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-sm text-secondary-foreground">
              <span className="px-2 py-0.5 bg-secondary rounded-full font-medium">{assessment.subject}</span>
              <span className="opacity-50">•</span>
              <span>{assessment.kind}</span>
              <span className="opacity-50">•</span>
              <span>{assessment.grade}</span>
              <span className="opacity-50">•</span>
              <span>{assessment.maximumMarks} Marks</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={assessment.status} />
            <Button variant="outline">Settings</Button>
          </div>
        </header>
      </div>

      {/* 3. Operational Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-surface shadow-none hover:bg-surface/80 transition-colors">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-secondary-foreground uppercase tracking-wider">Total Attempts</p>
            <p className="text-2xl font-heading text-foreground mt-1">{totalAttempts}</p>
          </CardContent>
        </Card>

        <Card className={`shadow-none transition-colors ${needsReview > 0 ? 'bg-warning/5 border-warning/20' : 'bg-surface'}`}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium uppercase tracking-wider ${needsReview > 0 ? 'text-warning-foreground' : 'text-secondary-foreground'}`}>Needs Review</p>
            <p className={`text-2xl font-heading mt-1 ${needsReview > 0 ? 'text-warning-foreground font-semibold' : 'text-foreground'}`}>{needsReview}</p>
          </CardContent>
        </Card>

        <Card className={`shadow-none transition-colors ${readyToPublish > 0 ? 'bg-info/5 border-info/20' : 'bg-surface'}`}>
          <CardContent className="p-4">
            <p className={`text-xs font-medium uppercase tracking-wider ${readyToPublish > 0 ? 'text-info' : 'text-secondary-foreground'}`}>Ready to Publish</p>
            <p className={`text-2xl font-heading mt-1 ${readyToPublish > 0 ? 'text-info font-semibold' : 'text-foreground'}`}>{readyToPublish}</p>
          </CardContent>
        </Card>

        <Card className="bg-surface shadow-none hover:bg-surface/80 transition-colors">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-secondary-foreground uppercase tracking-wider">Published</p>
            <p className="text-2xl font-heading text-foreground mt-1">{published}</p>
          </CardContent>
        </Card>
      </div>

      {/* 4 & 5. Teacher Attempt List & Analytics */}
      <div className="mt-8">
        <AssessmentTabs
          assessmentId={id}
          attempts={attempts}
          analytics={analytics}
        />
      </div>
    </main>
  );
}
