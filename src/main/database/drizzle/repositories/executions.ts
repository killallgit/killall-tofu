import { eq, desc, and, or, isNull } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { BaseDrizzleRepository } from './base';

import { executions, Execution, NewExecution } from '../schema/executions';
import { 
  Result,
  ExecutionRepository,
  ExecutionStatus,
  Execution as IExecution
} from '../../types';

/**
 * Drizzle implementation of ExecutionRepository.
 * Manages infrastructure destruction execution records.
 */
export class DrizzleExecutionRepository 
  extends BaseDrizzleRepository<Execution> 
  implements ExecutionRepository {
  
  constructor(db: BetterSQLite3Database) {
    super(db);
  }

  /**
   * Create a new execution record.
   */
  async create(
    executionData: Omit<IExecution, 'id'>
  ): Promise<Result<number>> {
    return this.executeQuery(async () => {
      const newExecution: NewExecution = {
        projectId: executionData.projectId,
        command: executionData.command,
        workingDir: executionData.workingDir,
        startedAt: executionData.startedAt,
        completedAt: executionData.completedAt || null,
        exitCode: executionData.exitCode ?? null,
        stdout: executionData.stdout || null,
        stderr: executionData.stderr || null,
        status: executionData.status,
        attemptNumber: executionData.attemptNumber
      };

      const [inserted] = await this.db
        .insert(executions)
        .values(newExecution)
        .returning({ id: executions.id });

      if (!inserted || !inserted.id) {
        throw new Error('Failed to create execution record');
      }

      return inserted.id;
    });
  }

  /**
   * Update an execution record with results.
   */
  async update(
    id: number,
    updates: Partial<Pick<IExecution, 'completedAt' | 'exitCode' | 'stdout' | 'stderr' | 'status'>>
  ): Promise<Result<IExecution>> {
    return this.executeQuery(async () => {
      const updateData: Partial<NewExecution> = {};

      // Map the updates to the schema format
      if (updates.completedAt !== undefined) {
        updateData.completedAt = updates.completedAt;
      }
      if (updates.exitCode !== undefined) {
        updateData.exitCode = updates.exitCode;
      }
      if (updates.stdout !== undefined) {
        updateData.stdout = updates.stdout;
      }
      if (updates.stderr !== undefined) {
        updateData.stderr = updates.stderr;
      }
      if (updates.status !== undefined) {
        updateData.status = updates.status;
      }

      const [updated] = await this.db
        .update(executions)
        .set(updateData)
        .where(eq(executions.id, id))
        .returning();

      if (!updated) {
        throw new Error(`Execution with id ${id} not found`);
      }

      return this.mapToInterface(updated);
    });
  }

  /**
   * Find executions for a specific project.
   */
  async findByProject(projectId: string): Promise<Result<IExecution[]>> {
    return this.executeQuery(async () => {
      const projectExecutions = await this.db
        .select()
        .from(executions)
        .where(eq(executions.projectId, projectId))
        .orderBy(desc(executions.startedAt));

      return projectExecutions.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Find all currently running executions.
   */
  async findRunning(): Promise<Result<IExecution[]>> {
    return this.executeQuery(async () => {
      const runningExecutions = await this.db
        .select()
        .from(executions)
        .where(
          or(
            eq(executions.status, 'running'),
            eq(executions.status, 'queued')
          )
        )
        .orderBy(executions.startedAt);

      return runningExecutions.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Find executions by status.
   */
  async findByStatus(status: ExecutionStatus): Promise<Result<IExecution[]>> {
    return this.executeQuery(async () => {
      const statusExecutions = await this.db
        .select()
        .from(executions)
        .where(eq(executions.status, status))
        .orderBy(desc(executions.startedAt));

      return statusExecutions.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Find failed executions that might need retry.
   */
  async findFailed(limit?: number): Promise<Result<IExecution[]>> {
    return this.executeQuery(async () => {
      const baseQuery = this.db
        .select()
        .from(executions)
        .where(
          or(
            eq(executions.status, 'failed'),
            eq(executions.status, 'timeout')
          )
        )
        .orderBy(desc(executions.startedAt));

      const failedExecutions = await (
        limit !== undefined
          ? baseQuery.limit(limit)
          : baseQuery
      );

      return failedExecutions.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Find the latest execution for a project.
   */
  async findLatestForProject(projectId: string): Promise<Result<IExecution | null>> {
    return this.executeQuery(async () => {
      const [latest] = await this.db
        .select()
        .from(executions)
        .where(eq(executions.projectId, projectId))
        .orderBy(desc(executions.startedAt))
        .limit(1);

      return latest ? this.mapToInterface(latest) : null;
    });
  }

  /**
   * Count executions by status for statistics.
   */
  async countByStatus(): Promise<Result<Record<string, number>>> {
    return this.executeQuery(async () => {
      const statuses = [
        'queued', 'running', 'completed', 'failed', 'cancelled', 'timeout'
      ] as const;
      const counts: Record<string, number> = {};

      for (const status of statuses) {
        const [result] = await this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(executions)
          .where(eq(executions.status, status));
        
        counts[status] = result?.count || 0;
      }

      return counts;
    });
  }

  /**
   * Get execution statistics for a project.
   */
  async getProjectStats(projectId: string): Promise<Result<{
    total: number;
    successful: number;
    failed: number;
    averageDuration: number;
  }>> {
    return this.executeQuery(async () => {
      const projectExecutions = await this.db
        .select()
        .from(executions)
        .where(eq(executions.projectId, projectId));

      const total = projectExecutions.length;
      const successful = projectExecutions.filter(e => e.status === 'completed').length;
      const failed = projectExecutions.filter(e => 
        e.status === 'failed' || e.status === 'timeout'
      ).length;

      // Calculate average duration for completed executions
      const completedWithDuration = projectExecutions.filter(e => 
        e.status === 'completed' && e.completedAt && e.startedAt
      );

      let averageDuration = 0;
      if (completedWithDuration.length > 0) {
        const totalDuration = completedWithDuration.reduce((sum, e) => {
          const duration = e.completedAt!.getTime() - e.startedAt.getTime();
          return sum + duration;
        }, 0);
        averageDuration = totalDuration / completedWithDuration.length;
      }

      return {
        total,
        successful,
        failed,
        averageDuration
      };
    });
  }

  /**
   * Clean up old execution records.
   */
  async cleanup(olderThanDays: number): Promise<Result<number>> {
    return this.executeQuery(async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.db
        .delete(executions)
        .where(
          and(
            lte(executions.startedAt, cutoffDate),
            or(
              eq(executions.status, 'completed'),
              eq(executions.status, 'failed'),
              eq(executions.status, 'cancelled')
            )
          )
        );

      return (result as any).changes || 0;
    });
  }

  /**
   * Map Drizzle execution type to interface type.
   */
  private mapToInterface(execution: Execution): IExecution {
    return {
      id: execution.id,
      projectId: execution.projectId,
      command: execution.command,
      workingDir: execution.workingDir,
      startedAt: execution.startedAt,
      completedAt: execution.completedAt || undefined,
      exitCode: execution.exitCode !== null ? execution.exitCode : undefined,
      stdout: execution.stdout || undefined,
      stderr: execution.stderr || undefined,
      status: execution.status as ExecutionStatus,
      attemptNumber: execution.attemptNumber || 1
    };
  }
}

// Import required for SQL template literal
import { sql } from 'drizzle-orm';
import { lte } from 'drizzle-orm';

/**
 * Functional query builders for composable execution queries.
 */
export const executionQueries = {
  /**
   * Build a query for running executions.
   */
  running: () => or(
    eq(executions.status, 'running'),
    eq(executions.status, 'queued')
  ),

  /**
   * Build a query for failed executions.
   */
  failed: () => or(
    eq(executions.status, 'failed'),
    eq(executions.status, 'timeout')
  ),

  /**
   * Build a query for completed executions.
   */
  completed: () => eq(executions.status, 'completed'),

  /**
   * Build a query for executions by project.
   */
  byProject: (projectId: string) => eq(executions.projectId, projectId),

  /**
   * Build a query for executions older than days.
   */
  olderThan: (days: number) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    return lte(executions.startedAt, cutoffDate);
  }
};