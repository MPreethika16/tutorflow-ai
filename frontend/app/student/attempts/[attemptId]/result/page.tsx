import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { ResultSummary } from "./components/ResultSummary";
import { QuestionResultCard, type QuestionResultAnswer } from "./components/QuestionResultCard";

async function fetchResultWithAuth(attemptId: string) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ');
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  try {
    const res = await fetch(`${apiUrl}/student/attempts/${attemptId}/result`, {
      headers: {
        'Cookie': cookieHeader,
        'Cache-Control': 'no-cache',
      },
    });

    if (!res.ok) {
      if (res.status === 404) return { error: 'NOT_FOUND' };
      if (res.status === 403) return { error: 'UNPUBLISHED' };
      if (res.status === 409) return { error: 'IN_PROGRESS' };
      return { error: 'API_ERROR' };
    }

    const data = await res.json();
    return { data };
  } catch (error) {
    console.error(`Fetch error for result:`, error);
    return { error: 'NETWORK_ERROR' };
  }
}

export default async function StudentResultPage({
  params,
}: {
  params: { attemptId: string };
}) {
  const { attemptId } = params;
  const resultRes = await fetchResultWithAuth(attemptId);

  // Handle specific backend HTTP errors
  if (resultRes.error === 'NOT_FOUND') {
    notFound();
  }

  if (resultRes.error) {
    let errorMessage = "We couldn't load your result right now.";
    if (resultRes.error === 'UNPUBLISHED') {
      errorMessage = "Your result isn't available yet. The teacher has not published this result yet.";
    } else if (resultRes.error === 'IN_PROGRESS') {
      errorMessage = "This assessment has not been submitted yet.";
    }

    return (
      <div className="flex flex-col items-center justify-center p-12 bg-surface border border-destructive/20 rounded-lg shadow-sm text-center space-y-4 max-w-4xl mx-auto mt-8">
        <p className="text-foreground font-medium text-lg">{errorMessage}</p>
        <Link href="/student" className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 mt-4">
          Return to My Assessments
        </Link>
      </div>
    );
  }

  const result = resultRes.data;

  // The type strictly models the exact backend response
  const { assessment, answers } = result;

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      <nav aria-label="Breadcrumb" className="mb-4">
        <ol className="flex items-center space-x-2 text-sm text-secondary-foreground font-medium">
          <li>
            <Link href="/student" className="hover:text-foreground transition-colors">
              My Assessments
            </Link>
          </li>
          <li>
            <svg className="w-4 h-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li className="text-foreground" aria-current="page">Result</li>
        </ol>
      </nav>

      <header className="space-y-1">
        <h1 className="text-3xl font-heading font-semibold text-foreground tracking-tight">
          {assessment.title}
        </h1>
        <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-primary">
          <span>{assessment.subject}</span>
          <span className="text-secondary-foreground opacity-40">•</span>
          <span className="text-secondary-foreground">{assessment.kind}</span>
        </div>
      </header>

      <ResultSummary
        finalMarks={result.finalMarks}
        maximumMarks={result.maximumMarks}
        publishedAt={result.publishedAt}
        submittedAt={result.submittedAt}
      />

      <section aria-label="Question Review">
        <div className="space-y-6">
          {answers.map((answer: QuestionResultAnswer, index: number) => (
            <QuestionResultCard
              key={answer.questionId}
              questionNumber={index + 1}
              answer={answer}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
