import { Telegraf, Markup } from 'telegraf';
import { getSession, clearSession } from './state';
import { processWorkflow } from './gemini';
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

bot.action('approve', (ctx) => {
  const chatId = ctx.chat?.id;
  if (chatId && getSession(chatId).pendingApproval) {
    ctx.reply('Approved! Task has been completed.');
    clearSession(chatId);
  } else if (chatId) {
    ctx.reply('Nothing to approve.');
  }
  ctx.answerCbQuery();
});

bot.action('retry', (ctx) => {
  const chatId = ctx.chat?.id;
  if (chatId) {
    getSession(chatId).pendingApproval = null;
    ctx.reply('Retrying... Please send the text again.');
  }
  ctx.answerCbQuery();
});

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const session = getSession(chatId);

  if (!session.workflow) {
    await ctx.reply('Please select a workflow first using /start');
    return;
  }

  const processingMessage = await ctx.reply('Processing your request with Gemini...');

  try {
    const result = await processWorkflow(session.workflow, ctx.message.text);
    
    if (result) {
      session.pendingApproval = result;
      const responseText = `*Summary:*\n${result.summary}\n\n*Tasks:*\n${result.tasks.map(t => `- ${t}`).join('\n')}\n\n*Confidence:* ${result.confidence}%`;
      
      await ctx.reply(responseText, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          Markup.button.callback('✅ Approve', 'approve'),
          Markup.button.callback('🔄 Retry', 'retry')
        ])
      });
    } else {
      await ctx.reply('Failed to process the text. Please try again.');
    }
  } catch (error) {
    console.error(error);
    await ctx.reply('An error occurred during processing.');
  } finally {
    try { await ctx.deleteMessage(processingMessage.message_id); } catch(e) {}
  }
});

export { bot };
