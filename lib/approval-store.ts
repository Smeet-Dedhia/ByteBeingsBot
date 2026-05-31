import { PendingApproval } from './types';

/**
 * PendingApprovalStore is an in-memory repository for storing extracted rows
 * that are waiting for user review/approval via the WebApp table or inline buttons.
 */
export class PendingApprovalStore {
  private store: Map<string, PendingApproval> = new Map();

  /**
   * Set approval data for a thread.
   */
  set(threadId: string, data: PendingApproval): void {
    this.store.set(threadId, data);
  }

  /**
   * Get approval data for a thread.
   */
  get(threadId: string): PendingApproval | undefined {
    return this.store.get(threadId);
  }

  /**
   * Remove approval data for a thread.
   */
  delete(threadId: string): void {
    this.store.delete(threadId);
  }

  /**
   * Check if a thread has pending approval data.
   */
  has(threadId: string): boolean {
    return this.store.has(threadId);
  }
}

// Singleton with hot-reload safety
const globalForApproval = global as unknown as { approvalStore: PendingApprovalStore };
export const approvalStore = globalForApproval.approvalStore || new PendingApprovalStore();
if (process.env.NODE_ENV !== 'production') {
  globalForApproval.approvalStore = approvalStore;
}
