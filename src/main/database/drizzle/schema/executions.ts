import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

import { projects } from './projects';

/**
 * Executions table: Command execution history and logs
 * Tracks all infrastructure destroy commands and their results
 */
export const executions = sqliteTable('executions', {
  // Auto-incrementing primary key
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Foreign key to projects table
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  
  // Full command that was executed
  command: text('command').notNull(),
  
  // Working directory for execution
  workingDir: text('working_dir').notNull(),
  
  // When execution began
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  
  // When execution finished (NULL if still running)
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  
  // Process exit code (NULL if still running)
  exitCode: integer('exit_code'),
  
  // Standard output from command
  stdout: text('stdout'),
  
  // Standard error from command
  stderr: text('stderr'),
  
  // Execution status
  status: text('status', {
    enum: ['queued', 'running', 'completed', 'failed', 'cancelled', 'timeout']
  }).notNull(),
  
  // Retry attempt number
  attemptNumber: integer('attempt_number').default(1)
}, (table) => ({
  // Performance indexes for common query patterns
  projectIdx: index('idx_executions_project').on(table.projectId),
  statusIdx: index('idx_executions_status').on(table.status),
  startedAtIdx: index('idx_executions_started_at').on(table.startedAt)
}));

// TypeScript type inference for select operations
export type Execution = typeof executions.$inferSelect;

// TypeScript type inference for insert operations
export type NewExecution = typeof executions.$inferInsert;

// Status enum for type safety
export const ExecutionStatus = {
  QUEUED: 'queued',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
} as const;

export type ExecutionStatusType = typeof ExecutionStatus[keyof typeof ExecutionStatus];