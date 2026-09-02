import * as React from "react";
import { Card, CardContent } from "@/components/ui/Card";

export default function Loading() {
  return (
    <main className="max-w-6xl mx-auto p-8 space-y-8 animate-pulse">
      {/* Skeleton Header */}
      <div className="space-y-4">
        <div className="h-4 w-48 bg-secondary/50 rounded"></div>

        <header className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-border pb-6 gap-4">
          <div className="w-full">
            <div className="h-8 w-1/3 bg-secondary/50 rounded mb-4"></div>
            <div className="flex flex-wrap gap-3">
              <div className="h-5 w-16 bg-secondary/50 rounded-full"></div>
              <div className="h-5 w-20 bg-secondary/50 rounded"></div>
              <div className="h-5 w-24 bg-secondary/50 rounded"></div>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="h-8 w-24 bg-secondary/50 rounded-full"></div>
            <div className="h-10 w-24 bg-secondary/50 rounded-md"></div>
          </div>
        </header>
      </div>

      {/* Skeleton Operational Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="bg-surface shadow-none border-border">
            <CardContent className="p-4">
              <div className="h-3 w-24 bg-secondary/50 rounded mb-3"></div>
              <div className="h-8 w-12 bg-secondary/50 rounded"></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Skeleton Attempt List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="h-6 w-40 bg-secondary/50 rounded"></div>
        </div>

        {/* Desktop Table Skeleton */}
        <div className="hidden md:block border border-border rounded-lg overflow-hidden bg-surface">
          <table className="w-full">
            <thead className="bg-secondary/20">
              <tr>
                {[1, 2, 3, 4, 5].map((i) => (
                  <th key={i} className="px-6 py-4"><div className="h-3 w-16 bg-secondary/50 rounded"></div></th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[1, 2, 3, 4].map((row) => (
                <tr key={row}>
                  <td className="px-6 py-4"><div className="h-4 w-32 bg-secondary/50 rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-5 w-24 bg-secondary/50 rounded-full"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-24 bg-secondary/50 rounded"></div></td>
                  <td className="px-6 py-4"><div className="h-4 w-16 bg-secondary/50 rounded"></div></td>
                  <td className="px-6 py-4 text-right"><div className="h-6 w-16 bg-secondary/50 rounded ml-auto"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Skeleton */}
        <div className="grid grid-cols-1 gap-4 md:hidden">
          {[1, 2, 3].map((row) => (
            <div key={row} className="border border-border rounded-lg p-4 bg-surface space-y-4">
              <div className="flex justify-between">
                <div className="h-5 w-32 bg-secondary/50 rounded"></div>
                <div className="h-5 w-24 bg-secondary/50 rounded-full"></div>
              </div>
              <div className="flex justify-between">
                <div className="h-4 w-24 bg-secondary/50 rounded"></div>
                <div className="h-4 w-16 bg-secondary/50 rounded"></div>
              </div>
              <div className="pt-3 border-t border-border">
                <div className="h-9 w-full bg-secondary/50 rounded-md"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
