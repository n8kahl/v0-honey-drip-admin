import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

const MASSIVE_API_KEY = process.env.MASSIVE_API_KEY;
const TOKEN_EXPIRY_SECONDS = 300; // 5 minutes

export async function POST() {
  if (!MASSIVE_API_KEY) {
    console.error('[Massive WS Token] MASSIVE_API_KEY not configured');
    return NextResponse.json(
      { error: 'API key not configured' },
      { status: 500 }
    );
  }

  try {
    // Generate ephemeral token with 5-minute expiry
    const expiresAt = Date.now() + (TOKEN_EXPIRY_SECONDS * 1000);
    const payload = JSON.stringify({
      apiKey: MASSIVE_API_KEY,
      expiresAt,
    });

    // Create HMAC signature using API key as secret
    const signature = createHmac('sha256', MASSIVE_API_KEY)
      .update(payload)
      .digest('hex');

    const token = `${Buffer.from(payload).toString('base64')}.${signature}`;

    console.log('[Massive WS Token] Generated ephemeral token, expires in 5 minutes');

    return NextResponse.json({
      token,
      expiresAt,
    });
  } catch (error: any) {
    console.error('[Massive WS Token] Failed to generate token:', error);
    return NextResponse.json(
      { error: 'Token generation failed' },
      { status: 500 }
    );
  }
}
