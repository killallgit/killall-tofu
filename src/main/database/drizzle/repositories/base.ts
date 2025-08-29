import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';

import { Result } from '../../../../shared/types';

/**
 * Base repository class providing common CRUD operations with Result type pattern.
 * Follows functional programming principles with no global state.
 */
export abstract class BaseDrizzleRepository<T> {
  protected readonly db: BetterSQLite3Database;

  constructor(db: BetterSQLite3Database) {
    this.db = db;
  }

  /**
   * Execute a database operation with proper error handling.
   * Returns Result type for functional error handling.
   */
  protected async executeQuery<R>(
    operation: () => R | Promise<R>
  ): Promise<Result<R>> {
    try {
      const result = await Promise.resolve(operation());
      return { ok: true, value: result };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error 
          ? error 
          : new Error(`Database operation failed: ${String(error)}`)
      };
    }
  }

  /**
   * Execute a database operation within a transaction.
   * Automatically handles rollback on error.
   */
  protected async executeTransaction<R>(
    operation: (tx: BetterSQLite3Database) => R | Promise<R>
  ): Promise<Result<R>> {
    try {
      const result = await this.db.transaction(async (tx) => {
        return await Promise.resolve(operation(tx as BetterSQLite3Database));
      });
      return { ok: true, value: result as R };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error 
          ? error 
          : new Error(`Transaction failed: ${String(error)}`)
      };
    }
  }

  /**
   * Generate a UUID for new entities.
   * Pure function with no side effects.
   */
  protected generateId(prefix: string = ''): string {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${randomPart}${timestamp}` : `${randomPart}${timestamp}`;
  }

  /**
   * Helper to get current timestamp for consistency.
   */
  protected getCurrentTimestamp(): Date {
    return new Date();
  }

  /**
   * Transform null values to undefined for optional fields.
   * Maintains immutability by returning new object.
   */
  protected nullToUndefined<T extends Record<string, any>>(obj: T): T {
    const result: any = { ...obj };
    Object.keys(result).forEach(key => {
      if (result[key] === null) {
        result[key] = undefined;
      }
    });
    return result as T;
  }

  /**
   * Paginate results with offset and limit.
   * Returns metadata along with results.
   */
  protected paginateResults<T>(
    items: T[],
    limit?: number,
    offset?: number
  ): { items: T[]; total: number; hasMore: boolean } {
    const total = items.length;
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    const paginatedItems = items.slice(start, end);
    
    return {
      items: paginatedItems,
      total,
      hasMore: end ? end < total : false
    };
  }
}

/**
 * Interface for repository implementations to ensure consistency.
 */
export interface IRepository<T, CreateT, UpdateT> {
  create(data: CreateT): Promise<Result<T>>;
  update(id: string | number, updates: UpdateT): Promise<Result<T>>;
  delete(id: string | number): Promise<Result<void>>;
  findById(id: string | number): Promise<Result<T | null>>;
}

/**
 * Type for batch operations result.
 */
export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ data: any; error: Error }>;
  totalProcessed: number;
}

/**
 * Helper function to create batch operations.
 * Processes items in parallel with error isolation.
 */
export const processBatch = async <T, R>(
  items: T[],
  processor: (item: T) => Promise<Result<R>>,
  batchSize: number = 50
): Promise<BatchResult<R>> => {
  const successful: R[] = [];
  const failed: Array<{ data: T; error: Error }> = [];
  
  // Process in batches to avoid overwhelming the database
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(item => processor(item))
    );
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.ok) {
          successful.push(result.value.value);
        } else {
          failed.push({ data: batch[index], error: result.value.error });
        }
      } else {
        failed.push({ 
          data: batch[index], 
          error: new Error(`Processing failed: ${result.reason}`)
        });
      }
    });
  }
  
  return {
    successful,
    failed,
    totalProcessed: items.length
  };
};