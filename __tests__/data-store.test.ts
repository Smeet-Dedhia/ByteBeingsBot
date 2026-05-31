import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { JsonFileDataStore } from '../lib/data-store';

describe('JsonFileDataStore', () => {
  let store: JsonFileDataStore;
  const testCollection = 'test_records';
  const basePath = path.join(process.cwd(), 'data', 'collections');
  const collectionPath = path.join(basePath, `${testCollection}.json`);

  beforeEach(() => {
    store = new JsonFileDataStore();
    // Clean up collection if it exists
    if (fs.existsSync(collectionPath)) {
      fs.unlinkSync(collectionPath);
    }
  });

  afterEach(() => {
    // Clean up collection
    if (fs.existsSync(collectionPath)) {
      fs.unlinkSync(collectionPath);
    }
  });

  it('should insert records with generated ID and timestamp', async () => {
    const record = await store.insert(testCollection, { task: 'Gym session', duration: 45 });
    expect(record.id).toBeTypeOf('string');
    expect(record.createdAt).toBeTypeOf('number');
    expect(record.task).toBe('Gym session');
    expect(record.duration).toBe(45);

    // Verify it saved to disk
    expect(fs.existsSync(collectionPath)).toBe(true);
    const content = JSON.parse(fs.readFileSync(collectionPath, 'utf8'));
    expect(content.length).toBe(1);
    expect(content[0].id).toBe(record.id);
  });

  it('should query records using simple where matching', async () => {
    await store.insert(testCollection, { priority: 'High', owner: 'Smeet' });
    await store.insert(testCollection, { priority: 'Low', owner: 'Smeet' });
    await store.insert(testCollection, { priority: 'High', owner: 'John' });

    const highSmeet = await store.query(testCollection, { where: { priority: 'High', owner: 'Smeet' } });
    expect(highSmeet.length).toBe(1);
    expect(highSmeet[0].priority).toBe('High');
    expect(highSmeet[0].owner).toBe('Smeet');

    const allSmeet = await store.query(testCollection, { where: { owner: 'Smeet' } });
    expect(allSmeet.length).toBe(2);
  });

  it('should support limit and sorting in queries', async () => {
    const r1 = await store.insert(testCollection, { score: 10 });
    // Small delay to ensure timestamp difference
    await new Promise(r => setTimeout(r, 20));
    const r2 = await store.insert(testCollection, { score: 50 });
    await new Promise(r => setTimeout(r, 20));
    const r3 = await store.insert(testCollection, { score: 30 });

    // Limit query
    const limited = await store.query(testCollection, { limit: 2 });
    expect(limited.length).toBe(2);

    // Sort by score ascending
    const sortedAsc = await store.query(testCollection, { sortBy: 'score', sortOrder: 'asc' });
    expect(sortedAsc.map(r => r.score)).toEqual([10, 30, 50]);

    // Sort by score descending
    const sortedDesc = await store.query(testCollection, { sortBy: 'score', sortOrder: 'desc' });
    expect(sortedDesc.map(r => r.score)).toEqual([50, 30, 10]);
  });

  it('should match items in arrays during query filtering', async () => {
    await store.insert(testCollection, { tags: ['tech', 'link'] });
    await store.insert(testCollection, { tags: ['recipe'] });

    const techItems = await store.query(testCollection, { where: { tags: 'tech' } });
    expect(techItems.length).toBe(1);
    expect(techItems[0].tags).toContain('tech');
  });

  it('should count records matching query filter', async () => {
    await store.insert(testCollection, { complete: true });
    await store.insert(testCollection, { complete: false });

    const total = await store.count(testCollection);
    expect(total).toBe(2);

    const completed = await store.count(testCollection, { where: { complete: true } });
    expect(completed).toBe(1);
  });
});
