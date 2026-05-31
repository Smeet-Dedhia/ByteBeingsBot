import { BaseAgent } from '../base';
import { AgentManifest, AgentTool } from '../../lib/types';
import { Type } from '@google/genai';
import { bot } from '../../lib/telegram';
import { GoogleGenAI } from '@google/genai';

const visionAi = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export class NutritionAgent extends BaseAgent {
  manifest: AgentManifest = {
    id: 'nutrition_tracker_agent',
    name: 'Nutrition Tracker Agent',
    description: 'Tracks calories/macros, scans grocery receipts/photos, and suggests customized recipes.',
    capabilities: ['analyze_food_photo', 'track_nutrition', 'suggest_recipes'],
    triggerExamples: [
      'Track these grocery item purchases',
      'Analyze this grocery receipt photo',
      'What recipes can I make with chicken and eggs?',
      'Track my daily calorie intake',
    ],
  };

  tools: AgentTool[] = [
    {
      declaration: {
        name: 'analyze_receipt_image',
        description: 'Extract purchased grocery items and macro details from an uploaded receipt image.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            file_id: { type: Type.STRING, description: 'Telegram photo file ID.' },
          },
          required: ['file_id'],
        },
      },
      execute: async (args) => {
        try {
          const fileId = args.file_id as string;
          const fileLink = await bot.telegram.getFileLink(fileId);
          const response = await fetch(fileLink.toString());
          const arrayBuffer = await response.arrayBuffer();
          const base64Image = Buffer.from(arrayBuffer).toString('base64');

          // Call Gemini Vision model to extract receipt data
          const visionResponse = await visionAi.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    inlineData: {
                      mimeType: 'image/jpeg',
                      data: base64Image,
                    },
                  },
                  {
                    text: 'Identify all grocery items, prices, and estimate calorie/macro values per item. Output as JSON array: [{ name, price, calories, protein, carbs, fat }]. Only return JSON.',
                  },
                ],
              },
            ],
            config: {
              responseMimeType: 'application/json',
            },
          });

          const resultText = visionResponse.text || '[]';
          const items = JSON.parse(resultText);
          return { items };
        } catch (error: any) {
          return { error: error.message || 'Image analysis failed' };
        }
      },
    },
  ];

  getSystemPrompt(): string {
    return `You are a Nutrition and Calorie Tracker Assistant.
Your goal is to parse food receipt pictures, document weekly groceries into the persistent dataStore under "nutrition_entries" or "grocery_logs", and suggest recipes.
Always prompt the user when they send receipts, run analyze_receipt_image, log it using save_to_collection, and suggest customized recipes using recipe generation.`;
  }
}
