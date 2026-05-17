import { describe, test, expect, vi } from 'vitest';
import { bot } from '@/lib/telegram';

// Mock the Gemini API to prevent actual network requests during testing
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({ summary: 'Mock Summary', tasks: ['Mock Task'], confidence: 99 })
        })
      };
    },
    Type: { OBJECT: 'OBJECT', STRING: 'STRING', ARRAY: 'ARRAY', NUMBER: 'NUMBER' }
  };
});

describe('Telegram Bot', () => {
  test('bot instance should be created and configured', () => {
    expect(bot).toBeDefined();
    // Telegraf exposes botInfo once launched, but instance should exist
    expect(bot.handleUpdate).toBeTypeOf('function');
  });
});
