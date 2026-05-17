import { WorkflowType } from './types';

export interface WorkflowDef {
  name: string;
  systemInstruction: string;
}

export const WORKFLOWS: Record<WorkflowType, WorkflowDef> = {
  meeting_tasks: {
    name: 'Meeting Tasks',
    systemInstruction: `You are an AI assistant that extracts meeting summaries and actionable tasks.
Please respond using the provided JSON schema. Extracted tasks should be concise. Evaluate confidence based on how clear the tasks are.`
  },
  prd_generator: {
    name: 'PRD Generator',
    systemInstruction: `You are an AI product manager. Given a feature idea, generate a Product Requirements Document (PRD) summary, a list of development tasks, and your confidence score based on the clarity of the idea. Respond using the provided JSON schema.`
  },
  grocery_list: {
    name: 'Grocery List',
    systemInstruction: `You are an AI assistant that extracts a categorized grocery list from a user's text.
Summarize the main request, list the grocery items as tasks, and provide a confidence score. Respond using the provided JSON schema.`
  }
};
