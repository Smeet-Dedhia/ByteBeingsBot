import { describe, it, expect, beforeEach } from 'vitest';
import { PendingApprovalStore } from '../lib/approval-store';
import { PendingApproval } from '../lib/types';

describe('PendingApprovalStore', () => {
  let store: PendingApprovalStore;

  const mockApproval: PendingApproval = {
    threadId: '12345',
    agentId: 'notion_agent',
    extractedData: {
      summary: 'Test extraction',
      rows: [{ task: 'Buy bread', owner: 'Smeet' }],
      confidence: 95,
    },
    notionSchema: { task: { type: 'title' }, owner: { type: 'select' } },
    notionDatabaseId: 'db_xyz',
    createdAt: Date.now(),
  };

  beforeEach(() => {
    store = new PendingApprovalStore();
  });

  it('should store and retrieve approval data', () => {
    store.set('12345', mockApproval);
    expect(store.has('12345')).toBe(true);
    expect(store.get('12345')).toEqual(mockApproval);
  });

  it('should return undefined for non-existent threadId', () => {
    expect(store.get('99999')).toBeUndefined();
    expect(store.has('99999')).toBe(false);
  });

  it('should delete stored approval data', () => {
    store.set('12345', mockApproval);
    store.delete('12345');
    expect(store.has('12345')).toBe(false);
    expect(store.get('12345')).toBeUndefined();
  });
});
