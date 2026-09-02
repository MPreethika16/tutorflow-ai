"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { markNotificationReadAction } from "../actions";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  referenceId: string | null;
  read: boolean;
  createdAt: string;
}

interface StudentNotificationBellProps {
  initialNotifications: Notification[];
}

export function StudentNotificationBell({ initialNotifications }: StudentNotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    // Only update local state if initialNotifications actually changes from server
    setNotifications(initialNotifications);
  }, [initialNotifications]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      setNotifications(prev => prev.map(notif => notif.id === n.id ? { ...notif, read: true } : notif));
      // Fire action in background
      markNotificationReadAction(n.id);
    }
    setIsOpen(false);

    if (n.type === "RESULT_PUBLISHED" && n.referenceId) {
      router.push(`/student/attempts/${n.referenceId}/result`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(dateString));
  };

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Notifications, ${unreadCount} unread`}
        aria-expanded={isOpen}
        aria-controls="notification-panel"
        className="relative p-2 rounded-full hover:bg-secondary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-foreground/80">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path>
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-primary rounded-full"></span>
        )}
      </button>

      {isOpen && (
        <div
          id="notification-panel"
          className="absolute right-0 mt-2 w-screen sm:w-80 md:w-96 bg-surface border border-border shadow-md rounded-md overflow-hidden z-50 flex flex-col max-h-[80vh] sm:max-h-[24rem]"
          style={{ right: "env(safe-area-inset-right)" }}
        >
          <div className="p-4 border-b border-border bg-surface/95 backdrop-blur z-10 sticky top-0">
            <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
          </div>

          <div className="overflow-y-auto flex-1 overscroll-contain">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-secondary-foreground text-sm space-y-2">
                <p>No notifications yet.</p>
                <p className="opacity-80">Updates about your assessments will appear here.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {notifications.map(n => (
                  <li
                    key={n.id}
                    className={`p-4 transition-colors ${!n.read ? 'bg-primary/5' : 'bg-surface'}`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-start gap-4">
                        <h3 className={`text-sm ${!n.read ? 'font-semibold text-foreground' : 'font-medium text-secondary-foreground'}`}>
                          {n.title}
                        </h3>
                        <span className="text-[10px] text-secondary-foreground/70 whitespace-nowrap pt-1">
                          {formatDate(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-snug">
                        {n.message}
                      </p>
                      <button
                        onClick={() => handleNotificationClick(n)}
                        className="text-xs font-medium text-primary hover:underline self-start mt-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm min-h-[44px] sm:min-h-0 flex items-center"
                      >
                        View result
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
