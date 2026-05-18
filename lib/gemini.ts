import { GoogleGenAI, Type, Schema } from '@google/genai';
import { WORKFLOWS } from './workflows';
import { WorkflowType, ProcessedOutput } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function processWorkflow(workflowType: WorkflowType, text: string, schema?: Record<string, any>): Promise<ProcessedOutput | null> {
  try {
    const workflow = WORKFLOWS[workflowType];
    if (!workflow) throw new Error('Invalid workflow type');

    const rowsSchemaProperties: Record<string, Schema> = {};
    if (schema) {
      for (const [key, prop] of Object.entries(schema)) {
        if (prop.type === 'number') {
          rowsSchemaProperties[key] = { type: Type.NUMBER, description: `Notion property type: ${prop.type}` };
        } else {
          rowsSchemaProperties[key] = { type: Type.STRING, description: `Notion property type: ${prop.type}` + (prop.options ? ` (Valid options: ${prop.options.join(', ')})` : '') };
        }
      }
    } else {
      // Fallback
      rowsSchemaProperties['Task'] = { type: Type.STRING };
    }

    const dynamicResponseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: 'A brief summary of the input text.' },
        rows: { 
          type: Type.ARRAY, 
          items: { 
            type: Type.OBJECT, 
            properties: rowsSchemaProperties
          }, 
          description: 'Actionable items extracted matching the Notion schema. For select/status columns, use valid options only. Ensure one row per actionable item.' 
        },
        confidence: { type: Type.NUMBER, description: 'Confidence score (0-100) based on clarity.' },
      },
      required: ['summary', 'rows', 'confidence'],
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: text,
      config: {
        systemInstruction: workflow.systemInstruction + (schema ? `\n\nYour output rows MUST map exactly to the provided Notion schema properties and respect valid options.` : ''),
        responseMimeType: 'application/json',
        responseSchema: dynamicResponseSchema,
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
