import React from "react";
import Link from "next/link";
import { cookies } from "next/headers";
import { StudentNotificationBell, Notification } from "./components/StudentNotificationBell";

async function getNotifications(): Promise<Notification[]> {
  try {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

    const res = await fetch(`${apiUrl}/notifications`, {
      headers: {
        "Cookie": cookieHeader,
        "Cache-Control": "no-cache",
      }
    });

    if (res.ok) {
      return await res.json();
    }
    return [];
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return [];
  }
}

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const notifications = await getNotifications();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="bg-surface border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/student" className="flex items-center gap-2 group">
            <div className="w-8 h-8 bg-primary text-primary-foreground rounded flex items-center justify-center font-heading font-bold text-lg">
              T
            </div>
            <span className="font-heading font-semibold text-lg text-foreground tracking-tight group-hover:text-primary transition-colors">
              TutorFlow
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <StudentNotificationBell initialNotifications={notifications} />
            <div className="w-8 h-8 rounded-full bg-secondary/50 flex items-center justify-center text-sm font-medium text-secondary-foreground">
              S
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl mx-auto p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
