import { BaseAgent } from '../base';
import { AgentManifest, AgentTool } from '../../lib/types';
import { Type } from '@google/genai';
import * as fs from 'fs';
import * as path from 'path';
import { bot } from '../../lib/telegram';

export class SaveLaterAgent extends BaseAgent {
  manifest: AgentManifest = {
    id: 'save_later_agent',
    name: 'Save For Later Agent',
    description: 'Saves links, websites, bookmarks, files, and documents for later review.',
    capabilities: ['save_link', 'save_file', 'query_saved_items'],
    triggerExamples: [
      'Save this link for later',
      'Bookmark this website',
      'Download and save this file attachment',
      'What links have I saved recently?',
    ],
  };

  tools: AgentTool[] = [
    {
      declaration: {
        name: 'download_telegram_file',
        description: 'Download a file attachment from Telegram using its file ID and save it locally.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            file_id: { type: Type.STRING, description: 'The Telegram file ID.' },
            filename: { type: Type.STRING, description: 'The name of the file.' },
          },
          required: ['file_id', 'filename'],
        },
      },
      execute: async (args) => {
        try {
          const fileId = args.file_id as string;
          const filename = args.filename as string;
          
          const fileLink = await bot.telegram.getFileLink(fileId);
          const response = await fetch(fileLink.toString());
          const buffer = await response.arrayBuffer();

          const dir = path.join(process.cwd(), 'data', 'files');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

          const filePath = path.join(dir, filename);
          fs.writeFileSync(filePath, Buffer.from(buffer));

          return { success: true, filePath: `/data/files/${filename}`, filename };
        } catch (error: any) {
          return { error: error.message || 'File download failed' };
        }
      },
    },
  ];

  getSystemPrompt(): string {
    return `You are a Bookmark and File Assistant.
Your goal is to save bookmarks, web URLs, and Telegram documents to the user's collections.

1. If the user sent a link/URL:
   - Save it into the "saved_links" collection.
   - Use the save_to_collection tool with fields: { url, title, tags[], savedAt }
2. If the user sent a file/document:
   - Call "download_telegram_file" first to save the file locally.
   - Save its reference into the "saved_files" collection using the save_to_collection tool with fields: { filename, localPath, mimeType, sizeBytes, savedAt }
3. If they ask what was saved, query the collections using query_collection.

Always inform the user in your final respond_to_user message that their item has been successfully bookmarked or saved.`;
  }
}
