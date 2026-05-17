import { bot } from '@/lib/telegram';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  // Webhook Security check
  const secretToken = req.headers.get('x-telegram-bot-api-secret-token');
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
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
