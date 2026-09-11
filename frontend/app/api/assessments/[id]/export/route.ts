import { NextRequest, NextResponse } from "next/server";
import { authenticatedFetch } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const res = await authenticatedFetch(`/assessments/${id}/export.csv`, {
      method: "GET",
    });

    if (!res.ok) {
      return new NextResponse("Failed to fetch export", { status: res.status });
    }

    const data = await res.blob();

    // Copy the relevant headers from the backend response
    const headers = new Headers();
    const contentType = res.headers.get('content-type');
    const contentDisposition = res.headers.get('content-disposition');

    if (contentType) headers.set('Content-Type', contentType);
    if (contentDisposition) headers.set('Content-Disposition', contentDisposition);

    return new NextResponse(data, {
      status: 200,
      headers
    });

  } catch (error) {
    console.error("Export route error:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
