import { StateGraph, MemorySaver, Annotation } from "@langchain/langgraph";
import { WorkflowType, ProcessedOutput } from "./types";
import { processWorkflow, generateClarification } from "./gemini";
import { getDatabaseSchema, dynamicPushToNotion } from "./notion";

// Define the state
export const GraphState = Annotation.Root({
  workflowType: Annotation<WorkflowType>(),
  rawInput: Annotation<string>(),
  extractedData: Annotation<ProcessedOutput | null>(),
  confidence: Annotation<number>(),
  requiresReview: Annotation<boolean>(),
  approved: Annotation<boolean>(),
  chatId: Annotation<number>(),
  clarificationQuestion: Annotation<string | null>(),
  clarificationResponse: Annotation<string | null>(),
  notionSchema: Annotation<Record<string, any> | null>(),
});

// Nodes
async function preprocessNode(state: typeof GraphState.State) {
  return { rawInput: state.rawInput.trim() };
}

async function extractNode(state: typeof GraphState.State) {
  if (!state.workflowType) throw new Error("Workflow type is required");
  
  let schema = state.notionSchema;
  if (!schema) {
    const databaseId = process.env.NOTION_DATABASE_ID;
    if (databaseId) {
      schema = await getDatabaseSchema(databaseId);
    }
  }

  const result = await processWorkflow(state.workflowType, state.rawInput, schema || undefined);
  
  if (result) {
    return {
      extractedData: result,
      confidence: result.confidence,
      notionSchema: schema
    };
  }
  return { extractedData: null, confidence: 0, notionSchema: schema };
}

async function confidenceNode(state: typeof GraphState.State) {
  const requiresReview = state.confidence < 75;
  return { requiresReview };
}

async function askClarificationNode(state: typeof GraphState.State) {
  if (!state.workflowType) throw new Error("Workflow type is required");
  const question = await generateClarification(state.workflowType, state.extractedData);
  return { clarificationQuestion: question };
}

async function waitForClarificationNode(state: typeof GraphState.State) {
  // dummy node to interrupt before
  return {};
}

async function processClarificationNode(state: typeof GraphState.State) {
  // Append the clarification response to the raw input
  const updatedInput = state.rawInput + "\nUser Clarification: " + state.clarificationResponse;
  return { rawInput: updatedInput, clarificationResponse: null, clarificationQuestion: null };
}

async function actionNode(state: typeof GraphState.State) {
  if (state.workflowType && state.extractedData && state.notionSchema) {
    try {
      const databaseId = process.env.NOTION_DATABASE_ID || '';
      await dynamicPushToNotion(databaseId, state.extractedData.rows, state.notionSchema);
      console.log("Action Executed and dynamically pushed to Notion for chat:", state.chatId);
    } catch (e) {
      console.error("Failed to push to Notion:", e);
    }
  }
  return {};
}

// Build Graph
const builder = new StateGraph(GraphState)
  .addNode("preprocess", preprocessNode)
  .addNode("extract", extractNode)
  .addNode("checkConfidence", confidenceNode)
  .addNode("askClarification", askClarificationNode)
  .addNode("waitForClarification", waitForClarificationNode)
  .addNode("processClarification", processClarificationNode)
  .addNode("action", actionNode)
  .addEdge("__start__", "preprocess")
  .addEdge("preprocess", "extract")
  .addEdge("extract", "checkConfidence")
  .addConditionalEdges("checkConfidence", (state) => {
    return state.requiresReview ? "askClarification" : "action";
  })
  .addEdge("askClarification", "waitForClarification")
  .addEdge("waitForClarification", "processClarification")
  .addEdge("processClarification", "extract")
  .addEdge("action", "__end__");

export const checkpointer = new MemorySaver();

export const workflowGraph = builder.compile({
  checkpointer,
  interruptBefore: ["action", "waitForClarification"],
});
