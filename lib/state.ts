import { WorkflowType, ProcessedOutput } from './types';

export interface UserSession {
  workflow?: WorkflowType;
  pendingApproval?: ProcessedOutput | null;
}

export const userSessions: Record<number, UserSession> = {};

export function getSession(chatId: number): UserSession {
  if (!userSessions[chatId]) {
    userSessions[chatId] = {};
  }
  return userSessions[chatId];
}

export function clearSession(chatId: number) {
  userSessions[chatId] = {};
}
