import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dynamicPushToNotion } from '../lib/notion';
import { Client } from '@notionhq/client';

// Mock the Notion SDK
vi.mock('@notionhq/client', () => {
  const mockCreate = vi.fn();
  return {
    Client: class {
      pages = { create: mockCreate };
    }
  };
});

describe('Notion Integration', () => {
  let notionClientInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NOTION_DATABASE_ID = 'test-db-id';
    notionClientInstance = new Client({ auth: 'test' });
  });

  it('should push dynamic rows based on schema', async () => {
    const rows = [
      { Task: 'Task 1', Workflow: 'meeting_tasks', Priority: 'High' }
    ];

    const schema = {
      Task: { type: 'title' },
      Workflow: { type: 'select', options: ['meeting_tasks'] },
      Priority: { type: 'rich_text' }
    };

    await dynamicPushToNotion('test-db-id', rows, schema);

    expect(notionClientInstance.pages.create).toHaveBeenCalledTimes(1);
    expect(notionClientInstance.pages.create).toHaveBeenCalledWith(expect.objectContaining({
      parent: { database_id: 'test-db-id' },
      properties: expect.objectContaining({
        "Task": { title: [{ text: { content: 'Task 1' } }] },
        "Workflow": { select: { name: 'meeting_tasks' } },
        "Priority": { rich_text: [{ text: { content: 'High' } }] }
      })
    }));
  });

  it('should ignore fields not in schema', async () => {
    const rows = [
      { Task: 'Task 1', UnknownField: 'Should ignore' }
    ];

    const schema = {
      Task: { type: 'title' }
    };

    await dynamicPushToNotion('test-db-id', rows, schema);

    expect(notionClientInstance.pages.create).toHaveBeenCalledTimes(1);
    expect(notionClientInstance.pages.create).toHaveBeenCalledWith(expect.objectContaining({
      properties: {
        "Task": { title: [{ text: { content: 'Task 1' } }] }
      }
    }));
  });
});
