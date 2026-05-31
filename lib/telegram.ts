import { Telegraf, Markup } from 'telegraf';
import { sessionManager } from './session';
import { agentRegistry } from './registry';
import { supervisorAgent } from '../agents/supervisor';
import { registerAllAgents } from '../agents';
import { generateSessionSummary } from './gemini';
import { AgentContext } from './types';
import { approvalStore } from './approval-store';
import { dynamicPushToNotion } from './notion';

// Ensure agents are registered at startup
registerAllAgents();

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '');

// ---- Commands ----

bot.command('start', async (ctx) => {
  await endSession(ctx.chat.id, 'abandoned');
  
  const manifests = agentRegistry.getAllManifests();
  const agentList = manifests
    .map(m => `• *${m.name}*: ${m.description}`)
    .join('\n');

  await ctx.reply(
    `🤖 *Welcome to ByteBeings Bot!*\n\n` +
    `I'm your AI assistant with specialized agents:\n\n` +
    `${agentList}\n\n` +
    `Just tell me what you need in natural language, and I'll route you to the right agent.\n\n` +
    `Commands:\n` +
    `/done — End the current session\n` +
    `/new — Start a fresh session\n` +
    `/agents — List available agents`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('agents', async (ctx) => {
  const manifests = agentRegistry.getAllManifests();
  const agentList = manifests
    .map(m => {
      const examples = m.triggerExamples.slice(0, 2).map(e => `  _"${e}"_`).join('\n');
      return `📌 *${m.name}* (\`${m.id}\`)\n${m.description}\n${examples}`;
    })
    .join('\n\n');

  await ctx.reply(`*Available Agents:*\n\n${agentList}`, { parse_mode: 'Markdown' });
});

bot.command('done', async (ctx) => {
  await endSession(ctx.chat.id, 'completed');
  await ctx.reply('✅ Session completed. Send any message to start a new one.');
});

bot.command('new', async (ctx) => {
  await endSession(ctx.chat.id, 'abandoned');
  await ctx.reply('🔄 New session started. What can I help you with?');
});

// ---- Action Callbacks ----

// Text-only approve button
bot.action(/approve_(.+)/, async (ctx) => {
  const threadId = ctx.match[1];
  const approval = approvalStore.get(threadId);
  if (approval) {
    try {
      await dynamicPushToNotion(approval.notionDatabaseId, approval.extractedData.rows, approval.notionSchema);
      approvalStore.delete(threadId);
      await ctx.reply('✅ Approved! Data successfully pushed to Notion.');
      sessionManager.setActiveAgent(Number(threadId), null);
    } catch (error: any) {
      await ctx.reply(`❌ Failed to push to Notion: ${error.message}`);
    }
  } else {
    await ctx.reply('⚠️ No active data found to approve.');
  }
  ctx.answerCbQuery();
});

// Retry button
bot.action(/retry_(.+)/, async (ctx) => {
  const threadId = ctx.match[1];
  approvalStore.delete(threadId);
  sessionManager.setActiveAgent(Number(threadId), null);
  await ctx.reply('🔄 Retry selected. Please send your text again.');
  ctx.answerCbQuery();
});

// ---- Media Message Handlers ----

// Route documents sent to Telegram
bot.on('document', async (ctx) => {
  const chatId = ctx.chat.id;
  const threadId = chatId.toString();
  const doc = ctx.message.document;
  const filename = doc.file_name || 'attachment.bin';
  const fileId = doc.file_id;

  const session = sessionManager.getOrCreateSession(chatId);
  const mediaMessage = `[Media: Document, Name: "${filename}", FileId: "${fileId}"] User wants to download and save this file attachment.`;
  
  sessionManager.addMessage(chatId, 'user', mediaMessage);

  const processingMsg = await ctx.reply('⏳ Analyzing attachment...');
  try {
    const result = await supervisorAgent.route(session, mediaMessage);
    if (result.type === 'delegation') {
      const { agentId, taskSummary } = result.delegation;
      const agent = agentRegistry.getAgent(agentId);
      if (agent) {
        // Log the delegation
        sessionManager.addMessage(chatId, 'system', `Delegated to ${agent.manifest.name}: ${taskSummary}`, agentId);

        const response = await agent.execute({
          chatId,
          threadId,
          userMessage: mediaMessage,
          conversationHistory: session.messages,
          taskSummary,
        });
        sessionManager.addMessage(chatId, 'assistant', response.message, agentId);
        sessionManager.recordAgentUsage(chatId, agentId, taskSummary, response.success);
        await sendAgentResponse(ctx, threadId, response.message);
      }
    } else if (result.type === 'direct_response') {
      sessionManager.addMessage(chatId, 'assistant', result.response.message);
      await ctx.reply(result.response.message, { parse_mode: 'Markdown' });
    }
  } catch (error: any) {
    await handleTelegramError(ctx, error, 'Failed to process document attachment');
  } finally {
    try { await ctx.deleteMessage(processingMsg.message_id); } catch(e) {}
  }
});

// Route photos sent to Telegram
bot.on('photo', async (ctx) => {
  const chatId = ctx.chat.id;
  const threadId = chatId.toString();
  const photos = ctx.message.photo;
  const bestPhoto = photos[photos.length - 1]; // Highest resolution
  const fileId = bestPhoto.file_id;
  const caption = ctx.message.caption || '';

  const session = sessionManager.getOrCreateSession(chatId);
  const mediaMessage = `[Media: Photo, FileId: "${fileId}", Caption: "${caption}"] User uploaded an image.`;
  
  sessionManager.addMessage(chatId, 'user', mediaMessage);

  const processingMsg = await ctx.reply('⏳ Analyzing uploaded photo...');
  try {
    const result = await supervisorAgent.route(session, mediaMessage);
    if (result.type === 'delegation') {
      const { agentId, taskSummary } = result.delegation;
      const agent = agentRegistry.getAgent(agentId);
      if (agent) {
        // Log the delegation
        sessionManager.addMessage(chatId, 'system', `Delegated to ${agent.manifest.name}: ${taskSummary}`, agentId);

        const response = await agent.execute({
          chatId,
          threadId,
          userMessage: mediaMessage,
          conversationHistory: session.messages,
          taskSummary,
        });
        sessionManager.addMessage(chatId, 'assistant', response.message, agentId);
        sessionManager.recordAgentUsage(chatId, agentId, taskSummary, response.success);
        await sendAgentResponse(ctx, threadId, response.message);
      }
    } else if (result.type === 'direct_response') {
      sessionManager.addMessage(chatId, 'assistant', result.response.message);
      await ctx.reply(result.response.message, { parse_mode: 'Markdown' });
    }
  } catch (error: any) {
    await handleTelegramError(ctx, error, 'Failed to process photo attachment');
  } finally {
    try { await ctx.deleteMessage(processingMsg.message_id); } catch(e) {}
  }
});

// ---- Main Message Handler ----

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const threadId = chatId.toString();
  const userMessage = ctx.message.text;

  // Get or create session
  const session = sessionManager.getOrCreateSession(chatId);

  // Add user message to session
  sessionManager.addMessage(chatId, 'user', userMessage);

  const processingMsg = await ctx.reply('⏳ Thinking...');

  try {
    // ROUTING DECISION:
    // If an agent is active (waiting for follow-up), route directly to it.
    // Otherwise, ask the Supervisor to route.

    if (session.activeAgentId) {
      // ---- FOLLOW-UP: Direct to active agent ----
      const agent = agentRegistry.getAgent(session.activeAgentId);
      if (!agent) {
        sessionManager.setActiveAgent(chatId, null);
        await ctx.reply('⚠️ The active agent is no longer available. Please try again.');
        return;
      }

      const context: AgentContext = {
        chatId,
        threadId,
        userMessage,
        conversationHistory: session.messages,
        taskSummary: '', // No new task summary for follow-ups
      };

      const response = await agent.execute(context);

      // Record in session
      sessionManager.addMessage(chatId, 'assistant', response.message, session.activeAgentId);

      if (response.requiresFollowUp) {
        // Agent needs more input — keep it active
        await sendAgentResponse(ctx, threadId, response.message);
      } else {
        // Agent is done — clear active agent
        sessionManager.recordAgentUsage(chatId, session.activeAgentId, 'follow-up', response.success);
        sessionManager.setActiveAgent(chatId, null);
        await sendAgentResponse(ctx, threadId, response.message);
      }

    } else {
      // ---- NEW INTENT: Ask Supervisor to route ----
      const result = await supervisorAgent.route(session, userMessage);

      if (result.type === 'direct_response') {
        // Supervisor responded directly (greeting, help, etc.)
        sessionManager.addMessage(chatId, 'assistant', result.response.message);
        await ctx.reply(result.response.message, { parse_mode: 'Markdown' });

      } else if (result.type === 'delegation') {
        // Supervisor delegated to an agent
        const { agentId, taskSummary } = result.delegation;
        const agent = agentRegistry.getAgent(agentId);

        if (!agent) {
          await ctx.reply(`⚠️ Agent "${agentId}" not found. Please try again.`);
          return;
        }

        // Log the delegation
        sessionManager.addMessage(chatId, 'system', `Delegated to ${agent.manifest.name}: ${taskSummary}`, agentId);

        // Build agent context
        const context: AgentContext = {
          chatId,
          threadId,
          userMessage,
          conversationHistory: session.messages,
          taskSummary,
        };

        // Execute the agent
        const response = await agent.execute(context);

        // Record in session
        sessionManager.addMessage(chatId, 'assistant', response.message, agentId);
        sessionManager.recordAgentUsage(chatId, agentId, taskSummary, response.success);

        if (response.requiresFollowUp) {
          // Agent needs follow-up — set it as active
          sessionManager.setActiveAgent(chatId, agentId);
          await sendAgentResponse(ctx, threadId, response.message);
        } else {
          await sendAgentResponse(ctx, threadId, response.message);
        }
      }
    }
  } catch (error: any) {
    sessionManager.addMessage(chatId, 'system', `Error: ${error.message}`);
    await handleTelegramError(ctx, error, 'Something went wrong');
  } finally {
    try { await ctx.deleteMessage(processingMsg.message_id); } catch(e) {}
  }
});

// ---- Helper Functions ----

/**
 * Handles Telegram errors dynamically, displaying a helpful message if the Gemini API quota is exceeded.
 */
async function handleTelegramError(ctx: any, error: any, contextMessage: string) {
  console.error('Telegram Handler Error:', error);
  
  const isRateLimit = 
    error?.status === 429 || 
    error?.statusCode === 429 ||
    String(error?.message).toLowerCase().includes('quota exceeded') ||
    String(error?.message).toLowerCase().includes('rate limit') ||
    String(error?.message).toLowerCase().includes('resource_exhausted') ||
    String(error?.message).toLowerCase().includes('429');

  if (isRateLimit) {
    await ctx.reply(
      '⚠️ *Gemini API Daily Quota/Rate Limit Exceeded*\n\n' +
      'You have exceeded the Gemini API free tier limit of 20 requests per day.\n\n' +
      'Please check your Gemini plan/billing details or try again later.',
      { parse_mode: 'Markdown' }
    );
  } else {
    await ctx.reply(`❌ ${contextMessage}. Please try again.`);
  }
}

/**
 * Sends a message, adding WebApp preview & approve buttons if there is a pending approval
 */
async function sendAgentResponse(ctx: any, threadId: string, message: string) {
  if (approvalStore.has(threadId)) {
    const appUrl = (global as any).APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
    const buttons = [];
    if (appUrl) {
      buttons.push([Markup.button.webApp('📊 View & Approve Rows', `${appUrl}/table?threadId=${threadId}`)]);
    }
    buttons.push([Markup.button.callback('✅ Approve (Text Only)', `approve_${threadId}`)]);
    buttons.push([Markup.button.callback('🔄 Retry', `retry_${threadId}`)]);

    await ctx.reply(message, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard(buttons)
    });
  } else {
    await ctx.reply(message, { parse_mode: 'Markdown' });
  }
}

async function endSession(chatId: number, outcome: 'completed' | 'abandoned'): Promise<void> {
  const session = sessionManager.getSession(chatId);
  if (!session || session.messages.length === 0) return;

  try {
    const summaryText = await generateSessionSummary(session.messages);
    await sessionManager.completeSession(chatId, outcome, summaryText);
  } catch (error) {
    console.error('Error ending session:', error);
    // Force clear even if summary fails
    await sessionManager.completeSession(chatId, outcome, 'Summary generation failed.');
  }
}

export { bot };
