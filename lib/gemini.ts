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

export async function generateClarification(workflowType: WorkflowType, extractedData: any): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `The following data was extracted for workflow '${workflowType}': ${JSON.stringify(extractedData)}. The confidence is low. Please generate a single, short clarification question asking the user for the missing details (e.g. missing owner, missing priority, unclear task). Do not include any greeting or explanation, just the question.`
    });
    return response.text || "Could you please provide more details?";
  } catch (error) {
    console.error('Gemini API Error (Clarification):', error);
    return "Could you please provide more details?";
  }
}
