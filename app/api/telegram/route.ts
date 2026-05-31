import { bot } from '@/lib/telegram';
import { sessionManager } from '@/lib/session';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Webhook Security check
  const secretToken = req.headers.get('x-telegram-bot-api-secret-token');
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const proto = req.headers.get('x-forwarded-proto') || 'https';
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || '';
  (global as any).APP_URL = `${proto}://${host}`;

  try {
    const body = await req.json();
    
    // Check timeouts periodically on incoming webhooks
    sessionManager.checkTimeouts().catch(err => {
      console.error('Error checking session timeouts:', err);
    });

    await bot.handleUpdate(body);
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Error handling Telegram webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'Telegram webhook endpoint is running' });
}
