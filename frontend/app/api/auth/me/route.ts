import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  const result = await getCurrentUser();

  if (result.status === 'authenticated') {
    return NextResponse.json(
      {
        authenticated: true,
        user: result.user,
      },
      { status: 200 },
    );
  }

  if (result.status === 'unauthenticated') {
    return NextResponse.json(
      {
        authenticated: false,
        error: 'UNAUTHENTICATED',
      },
      { status: 401 },
    );
  }

  return NextResponse.json(
    {
      authenticated: false,
      error: result.error,
      message: result.message,
    },
    { status: result.statusCode || 502 },
  );
}
