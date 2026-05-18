export type WorkflowType = 'meeting_tasks' | 'prd_generator' | 'grocery_list';

export interface ProcessedOutput {
  summary: string;
  rows: Record<string, any>[];
  confidence: number;
}
