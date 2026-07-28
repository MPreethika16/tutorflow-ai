type HealthResponse = {
  status: string;
  service: string;
  timestamp: string;
};

async function getBackendHealth(): Promise<HealthResponse | null> {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  try {
    const response = await fetch(`${apiUrl}/health`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export default async function Home() {
  const health = await getBackendHealth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50">
      <section className="w-full max-w-xl rounded-xl bg-white p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-slate-900">
          TutorFlow AI
        </h1>

        <p className="mt-2 text-slate-600">
          AI-assisted assessment and feedback for independent tutors.
        </p>

        <div className="mt-8 rounded-lg border p-4">
          <p className="font-medium text-slate-900">
            Backend connection
          </p>

          {health ? (
            <p className="mt-2 text-green-700">
              Connected to {health.service}
            </p>
          ) : (
            <p className="mt-2 text-red-700">
              Backend is unavailable
            </p>
          )}
        </div>
      </section>
    </main>
  );
}