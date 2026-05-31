import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SaveLaterAgent } from '../agents/save-later';
import { CalendarAgent } from '../agents/calendar';
import { NutritionAgent } from '../agents/nutrition';
import { SummarizerAgent } from '../agents/summarizer';
import { AgentContext } from '../lib/types';
import { dataStore } from '../lib/data-store';

// Use vi.hoisted to ensure mockGenerateContent is initialized before vi.mock executes
const { mockGenerateContent } = vi.hoisted(() => {
  return {
    mockGenerateContent: vi.fn(),
  };
});

vi.mock('@google/genai', () => {
  class MockGoogleGenAI {
    models = {
      generateContent: mockGenerateContent,
    };
  }
  return {
    GoogleGenAI: MockGoogleGenAI,
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      BOOLEAN: 'BOOLEAN',
      ARRAY: 'ARRAY',
      NUMBER: 'NUMBER',
    },
  };
});

// Mock telegram file tools
vi.mock('../lib/telegram', () => {
  return {
    bot: {
      telegram: {
        getFileLink: vi.fn().mockResolvedValue('https://api.telegram.org/file/bot123/photo.jpg'),
      },
    },
  };
});

describe('v2 Specialized Worker Agents', () => {
  let context: AgentContext;

  beforeEach(() => {
    context = {
      chatId: 12345,
      threadId: '12345',
      userMessage: 'Test message',
      conversationHistory: [],
      taskSummary: 'Test task',
    };
    mockGenerateContent.mockReset();
  });

  describe('SaveLaterAgent', () => {
    it('should have the correct manifest and tools', () => {
      const agent = new SaveLaterAgent();
      expect(agent.manifest.id).toBe('save_later_agent');
      expect(agent.tools.some(t => t.declaration.name === 'download_telegram_file')).toBe(true);
    });

    it('should run bookmarks extraction and trigger save_to_collection', async () => {
      const agent = new SaveLaterAgent();
      mockGenerateContent
        .mockResolvedValueOnce({
          functionCalls: [{
            name: 'save_to_collection',
            args: {
              collection: 'saved_links',
              data: { url: 'https://nextjs.org', title: 'Next.js', tags: ['tech'] },
            },
          }],
        })
        .mockResolvedValueOnce({
          functionCalls: [{ name: 'respond_to_user', args: { success: true, message: 'Saved!' } }],
        });

      const response = await agent.execute(context);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Saved!');
    });
  });

  describe('CalendarAgent', () => {
    it('should have the correct manifest and tools', () => {
      const agent = new CalendarAgent();
      expect(agent.manifest.id).toBe('calendar_agent');
      expect(agent.tools.some(t => t.declaration.name === 'create_calendar_event')).toBe(true);
      expect(agent.tools.some(t => t.declaration.name === 'list_calendar_events')).toBe(true);
    });

    it('should call list_calendar_events and return schedule', async () => {
      const agent = new CalendarAgent();
      mockGenerateContent
        .mockResolvedValueOnce({
          functionCalls: [{ name: 'list_calendar_events', args: {} }],
        })
        .mockResolvedValueOnce({
          functionCalls: [{ name: 'respond_to_user', args: { success: true, message: 'Schedule: gym session' } }],
        });

      const response = await agent.execute(context);
      expect(response.success).toBe(true);
      expect(response.message).toBe('Schedule: gym session');
    });
  });

  describe('NutritionAgent', () => {
    it('should have correct manifest id', () => {
      const agent = new NutritionAgent();
      expect(agent.manifest.id).toBe('nutrition_tracker_agent');
    });
  });

  describe('SummarizerAgent', () => {
    it('should have correct manifest id and scraper tools', () => {
      const agent = new SummarizerAgent();
      expect(agent.manifest.id).toBe('content_summarizer_agent');
      expect(agent.tools.some(t => t.declaration.name === 'fetch_article_text')).toBe(true);
    });
  });
});
