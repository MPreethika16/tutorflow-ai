import * as React from "react";
import { cookies } from "next/headers";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

import { StatusBadge } from "@/components/ui/StatusBadge";

// Fetch assessments from backend
async function getAssessments() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  // Forward cookies to the backend for auth
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');

  try {
    const res = await fetch(`${apiUrl}/teacher/assessments`, {
      cache: 'no-store',
      headers: {
        'Cookie': cookieHeader
      }
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (error) {
    return [];
  }
}

export default async function AssessmentsPage() {
  const assessments = await getAssessments();

  return (
    <main className="max-w-6xl mx-auto p-8 space-y-8">
      <header className="flex justify-between items-end border-b border-border pb-6">
        <div>
          <h1 className="text-4xl font-heading text-primary tracking-tight">Assessments</h1>
          <p className="text-secondary-foreground mt-2">Manage your classes and evaluate student submissions.</p>
        </div>
        <Button>Create Assessment</Button>
      </header>

      {assessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-surface border border-border rounded-lg shadow-sm text-center space-y-4">
          <p className="text-secondary-foreground text-lg">No assessments found.</p>
          <Button variant="outline">Create your first assessment</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assessments.map((a: any) => (
            <Card key={a.id} className="transition-transform motion-safe:hover:-translate-y-1 hover:shadow-md duration-200">
              <CardHeader>
                <div className="flex justify-between items-start">
                  {/* Changed to h2 for proper hierarchy */}
                  <h2 className="text-xl font-heading font-semibold text-primary">{a.title}</h2>
                  <span className="text-xs font-medium px-2 py-1 bg-secondary text-secondary-foreground rounded-full">
                    {a.subject}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground/80 line-clamp-2">{a.description || 'No description provided.'}</p>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-secondary-foreground">Grade</p>
                    <p className="font-medium">{a.grade}</p>
                  </div>
                  <div>
                    <p className="text-secondary-foreground">Status</p>
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-secondary/20 pt-4">
                <a href={`/teacher/assessments/${a.id}`} className="text-sm font-medium text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                  View Details &rarr;
                </a>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
