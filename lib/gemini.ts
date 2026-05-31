import { GoogleGenAI } from '@google/genai';
import { SessionMessage } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Generate a concise summary of a completed session.
 * Called by SessionManager.completeSession().
 */
export async function generateSessionSummary(messages: SessionMessage[]): Promise<string> {
  const transcript = messages
    .map(m => `[${m.role}${m.agentId ? ` (${m.agentId})` : ''}]: ${m.content}`)
    .join('\n');

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite',
    contents: transcript,
    config: {
      systemInstruction: 'Summarize this conversation in 1-2 sentences. Focus on what the user wanted and what was accomplished. Be concise and factual.',
    },
  });

  return response.text || 'Session completed.';
}
