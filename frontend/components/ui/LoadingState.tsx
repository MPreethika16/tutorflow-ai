import * as React from "react";

export function LoadingState({ className = "" }: { className?: string }) {
  return (
    <div className={`flex flex-col items-center justify-center p-12 ${className}`}>
      <div className="flex space-x-2 items-center">
        <div className="w-2 h-2 bg-primary rounded-full animate-[pulse_1.5s_ease-in-out_infinite]" />
        <div className="w-2 h-2 bg-primary rounded-full animate-[pulse_1.5s_ease-in-out_0.3s_infinite]" />
        <div className="w-2 h-2 bg-primary rounded-full animate-[pulse_1.5s_ease-in-out_0.6s_infinite]" />
      </div>
      <p className="mt-4 text-sm text-foreground/70 font-medium">Loading...</p>
    </div>
  );
}
