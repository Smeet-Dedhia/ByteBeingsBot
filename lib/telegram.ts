import { Telegraf, Markup } from 'telegraf';
import { getSession, clearSession } from './state';
import { workflowGraph } from './graph';
import { WORKFLOWS } from './workflows';
import { WorkflowType } from './types';

const bot = new Telegraf(process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN || '');

bot.command('start', (ctx) => {
  clearSession(ctx.chat.id);
  ctx.reply('Welcome to TeleButtler! Please select a workflow:', 
    Markup.inlineKeyboard([
      [Markup.button.callback('Meeting Tasks', 'workflow_meeting_tasks')],
      [Markup.button.callback('PRD Generator', 'workflow_prd_generator')],
      [Markup.button.callback('Grocery List', 'workflow_grocery_list')]
    ])
  );
});

bot.action(/workflow_(.+)/, (ctx) => {
  const workflowType = ctx.match[1] as WorkflowType;
  const chatId = ctx.chat?.id;
  
  if (chatId) {
    const session = getSession(chatId);
    session.workflow = workflowType;
    const workflowName = WORKFLOWS[workflowType]?.name || workflowType;
    ctx.reply(`Selected: ${workflowName}. Please send me the text to process.`);
    ctx.answerCbQuery();
  }
});

bot.action('approve', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (chatId) {
    const threadId = chatId.toString();
    const state = await workflowGraph.getState({ configurable: { thread_id: threadId } });
    
    if (state.next && state.next.includes("action")) {
      await ctx.reply('Approving and executing action...');
      await workflowGraph.updateState({ configurable: { thread_id: threadId } }, { approved: true });
      await workflowGraph.invoke(null, { configurable: { thread_id: threadId } });
      await ctx.reply('Approved! Action has been completed.');
      clearSession(chatId);
    } else {
      await ctx.reply('Nothing to approve or action already executed.');
    }
  }
  ctx.answerCbQuery();
});

bot.action('retry', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (chatId) {
    const threadId = chatId.toString();
    // Clear graph state for this thread by creating a new empty state or just prompting for text again
    await ctx.reply('Retrying... Please send the text again.');
  }
  ctx.answerCbQuery();
});

async function handleGraphProgress(ctx: any, threadId: string, invokeArgs: any) {
  const resultState = await workflowGraph.invoke(invokeArgs, { configurable: { thread_id: threadId } });
  const state = await workflowGraph.getState({ configurable: { thread_id: threadId } });
  
  if (state.next && state.next.includes("waitForClarification") && resultState.clarificationQuestion) {
    await ctx.reply(`⚠️ Need Clarification:\n${resultState.clarificationQuestion}`);
  } else if (state.next && state.next.includes("action") && resultState.extractedData) {
    const result = resultState.extractedData;
    const responseText = `*Summary:*\n${result.summary}\n\n*Tasks:*\n${result.tasks.map((t: string) => `- ${t}`).join('\n')}\n\n*Confidence:* ${result.confidence}%`;
    
    await ctx.reply(responseText, {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        Markup.button.callback('✅ Approve', 'approve'),
        Markup.button.callback('🔄 Retry', 'retry')
      ])
    });
  } else {
    await ctx.reply('Failed to process. Please try again.');
  }
}

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const threadId = chatId.toString();
  const session = getSession(chatId);

  const state = await workflowGraph.getState({ configurable: { thread_id: threadId } });

  // Do not show "Processing..." if they just need to pick a workflow
  if (!state.next?.includes("waitForClarification") && !session.workflow) {
    await ctx.reply('Please select a workflow first using /start');
    return;
  }

  const processingMessage = await ctx.reply('Processing...');

  try {
    if (state.next && state.next.includes("waitForClarification")) {
      await workflowGraph.updateState({ configurable: { thread_id: threadId } }, { clarificationResponse: ctx.message.text });
      await handleGraphProgress(ctx, threadId, null);
    } else {
      await handleGraphProgress(ctx, threadId, { workflowType: session.workflow, rawInput: ctx.message.text, chatId });
    }
  } catch (error) {
    console.error(error);
    await ctx.reply('An error occurred during processing.');
  } finally {
    try { await ctx.deleteMessage(processingMessage.message_id); } catch(e) {}
  }
});

export { bot };
