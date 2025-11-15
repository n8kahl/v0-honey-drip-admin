import { NextRequest, NextResponse } from 'next/server';

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const MASSIVE_API_BASE = 'https://api.polygon.io';

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  if (!MASSIVE_API_KEY) {
    console.error('[Massive Proxy] MASSIVE_API_KEY not configured');
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  const path = params.path.join('/');
  const searchParams = request.nextUrl.searchParams;
  const queryString = searchParams.toString();
  
  const url = `${MASSIVE_API_BASE}/${path}${queryString ? `?${queryString}` : ''}`;
  
  console.log('[Massive Proxy] GET:', path);

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${MASSIVE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Massive Proxy] Error:', response.status, errorText);
      return NextResponse.json(
        { error: errorText || response.statusText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Massive Proxy] Request failed:', error);
    return NextResponse.json(
      { error: error.message || 'Request failed' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  if (!MASSIVE_API_KEY) {
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  const path = params.path.join('/');
  const body = await request.json();
  
  const url = `${MASSIVE_API_BASE}/${path}`;
  
  console.log('[Massive Proxy] POST:', path);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MASSIVE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Massive Proxy] Error:', response.status, errorText);
      return NextResponse.json(
        { error: errorText || response.statusText },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Massive Proxy] Request failed:', error);
    return NextResponse.json(
      { error: error.message || 'Request failed' },
      { status: 500 }
    );
  }
}
