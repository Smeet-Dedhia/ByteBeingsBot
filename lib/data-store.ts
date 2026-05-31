import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * A record in any collection.
 * All records have a unique ID and creation timestamp.
 * Everything else is collection-specific.
 */
export interface DataRecord {
  id: string;
  createdAt: number;
  [key: string]: any;
}

/**
 * Filter for querying collections.
 */
export interface QueryFilter {
  where?: Record<string, any>;
  after?: number;
  before?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * UserDataStore provides persistent, queryable storage for all agents.
 */
export interface UserDataStore {
  /** Insert a record into a collection. Returns the record with generated id + createdAt. */
  insert(collection: string, data: Record<string, any>): Promise<DataRecord>;

  /** Query records in a collection with optional filters. */
  query(collection: string, filter?: QueryFilter): Promise<DataRecord[]>;

  /** Get all records in a collection (with optional limit). */
  getAll(collection: string, limit?: number): Promise<DataRecord[]>;

  /** Get a single record by ID. */
  getById(collection: string, id: string): Promise<DataRecord | null>;

  /** Count records in a collection (optionally filtered). */
  count(collection: string, filter?: QueryFilter): Promise<number>;
}

export class JsonFileDataStore implements UserDataStore {
  private basePath = path.join(process.cwd(), 'data', 'collections');

  constructor() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private getCollectionPath(collection: string): string {
    return path.join(this.basePath, `${collection}.json`);
  }

  private async loadCollection(collection: string): Promise<DataRecord[]> {
    const filePath = this.getCollectionPath(collection);
    if (!fs.existsSync(filePath)) return [];
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as DataRecord[];
    } catch {
      return [];
    }
  }

  private async saveCollection(collection: string, records: DataRecord[]): Promise<void> {
    const filePath = this.getCollectionPath(collection);
    fs.writeFileSync(filePath, JSON.stringify(records, null, 2), 'utf8');
  }

  async insert(collection: string, data: Record<string, any>): Promise<DataRecord> {
    const records = await this.loadCollection(collection);
    const record: DataRecord = {
      id: randomUUID(),
      createdAt: Date.now(),
      ...data,
    };
    records.push(record);
    await this.saveCollection(collection, records);
    return record;
  }

  async query(collection: string, filter?: QueryFilter): Promise<DataRecord[]> {
    let records = await this.loadCollection(collection);

    if (filter?.after) {
      records = records.filter(r => r.createdAt > filter.after!);
    }
    if (filter?.before) {
      records = records.filter(r => r.createdAt < filter.before!);
    }
    if (filter?.where) {
      records = records.filter(r =>
        Object.entries(filter.where!).every(([k, v]) => {
          if (Array.isArray(r[k])) {
            return r[k].includes(v);
          }
          return r[k] === v;
        })
      );
    }

    if (filter?.sortBy) {
      records.sort((a, b) => {
        const valA = a[filter.sortBy!];
        const valB = b[filter.sortBy!];
        const order = filter.sortOrder === 'desc' ? -1 : 1;
        return valA > valB ? order : -order;
      });
    }

    if (filter?.limit) {
      records = records.slice(0, filter.limit);
    }

    return records;
  }

  async getAll(collection: string, limit?: number): Promise<DataRecord[]> {
    return this.query(collection, { limit });
  }

  async getById(collection: string, id: string): Promise<DataRecord | null> {
    const records = await this.loadCollection(collection);
    return records.find(r => r.id === id) || null;
  }

  async count(collection: string, filter?: QueryFilter): Promise<number> {
    const records = await this.query(collection, filter);
    return records.length;
  }
}

// Singleton with hot-reload safety
const globalForStore = global as unknown as { dataStore: UserDataStore };
export const dataStore = globalForStore.dataStore || new JsonFileDataStore();
if (process.env.NODE_ENV !== 'production') {
  globalForStore.dataStore = dataStore;
}
