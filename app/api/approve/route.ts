import { NextRequest, NextResponse } from 'next/server';
import { workflowGraph } from '@/lib/graph';
import { bot } from '@/lib/telegram';
import { clearSession } from '@/lib/state';

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let threadId: string | null = null;
    let isForm = false;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      isForm = true;
      const formData = await req.formData();
      threadId = formData.get('threadId') as string;
    } else {
      const json = await req.json();
      threadId = json.threadId;
    }

    if (!threadId) {
      if (isForm) return new NextResponse('Missing threadId', { status: 400 });
      return NextResponse.json({ error: 'Missing threadId' }, { status: 400 });
    }

    const state = await workflowGraph.getState({ configurable: { thread_id: threadId } });
    if (!state || !state.values) {
      if (isForm) return new NextResponse('No active state found', { status: 404 });
      return NextResponse.json({ error: 'No active state found' }, { status: 404 });
    }

    if (state.next && state.next.includes("action")) {
      // Approve and trigger action in LangGraph
      await workflowGraph.updateState({ configurable: { thread_id: threadId } }, { approved: true });
      await workflowGraph.invoke(null, { configurable: { thread_id: threadId } });

      // Send a follow-up confirmation message to the user in Telegram
      const chatId = Number(threadId);
      await bot.telegram.sendMessage(chatId, '✅ Approved via Web App! Extracted data has been successfully pushed to Notion.');
      clearSession(chatId);

      if (isForm) {
        return new NextResponse(`
          <!DOCTYPE html>
          <html>
            <head>
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <style>
                body { background: #07050e; color: #fff; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
                h1 { color: #10b981; font-size: 24px; margin-bottom: 10px; }
                p { color: #94a3b8; font-size: 14px; margin-bottom: 30px; }
                button { background: #4f46e5; border: none; color: white; padding: 15px 30px; border-radius: 12px; font-weight: bold; font-size: 16px; cursor: pointer; width: 100%; max-width: 300px; }
              </style>
            </head>
            <body>
              <h1>✅ Approved & Pushed!</h1>
              <p>The data has been successfully saved to Notion.</p>
              <button onclick="window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp.close() : window.close()">Close Window</button>
              <script src="https://telegram.org/js/telegram-web-app.js"></script>
              <script>
                // Try to auto-close after 2 seconds
                setTimeout(() => {
                  if (window.Telegram && window.Telegram.WebApp) {
                    window.Telegram.WebApp.close();
                  }
                }, 2000);
              </script>
            </body>
          </html>
        `, {
          headers: { 'Content-Type': 'text/html' }
        });
      }

      return NextResponse.json({ status: 'success' });
    } else {
      if (isForm) return new NextResponse('Graph is not waiting for action approval', { status: 400 });
      return NextResponse.json({ error: 'Graph is not waiting for action approval' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error approving state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
