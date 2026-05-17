import { GoogleGenAI, Type, Schema } from '@google/genai';
import { WORKFLOWS } from './workflows';
import { WorkflowType, ProcessedOutput } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: 'A brief summary of the input text.' },
    tasks: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'Actionable items extracted.' },
    confidence: { type: Type.NUMBER, description: 'Confidence score (0-100) based on clarity.' },
  },
  required: ['summary', 'tasks', 'confidence'],
};

export async function processWorkflow(workflowType: WorkflowType, text: string): Promise<ProcessedOutput | null> {
  try {
    const workflow = WORKFLOWS[workflowType];
    if (!workflow) throw new Error('Invalid workflow type');

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction: workflow.systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: responseSchema,
      }
    });

    return response.text ? (JSON.parse(response.text) as ProcessedOutput) : null;
  } catch (error) {
    console.error('Gemini API Error:', error);
    return null;
  }
}
