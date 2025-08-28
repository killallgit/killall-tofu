import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Projects table: Stores discovered infrastructure projects
 * Each project represents a Terraform/OpenTofu directory with a .killall.yaml config
 */
export const projects = sqliteTable('projects', {
  // UUID for project identification
  id: text('id').primaryKey(),
  
  // Absolute filesystem path to project (must be unique)
  path: text('path').notNull().unique(),
  
  // Optional display name from config
  name: text('name'),
  
  // JSON-serialized ProjectConfig
  config: text('config').notNull(),
  
  // When project was first discovered
  discoveredAt: integer('discovered_at', { mode: 'timestamp' }).notNull(),
  
  // Scheduled destruction time
  destroyAt: integer('destroy_at', { mode: 'timestamp' }).notNull(),
  
  // Project lifecycle status
  status: text('status', {
    enum: ['active', 'pending', 'destroying', 'destroyed', 'failed', 'cancelled']
  }).notNull(),
  
  // Automatic timestamps
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  // Performance indexes for common query patterns
  statusIdx: index('idx_projects_status').on(table.status),
  destroyAtIdx: index('idx_projects_destroy_at').on(table.destroyAt),
  pathIdx: index('idx_projects_path').on(table.path)
}));

// TypeScript type inference for select operations
export type Project = typeof projects.$inferSelect;

// TypeScript type inference for insert operations
export type NewProject = typeof projects.$inferInsert;

// Status enum for type safety
export const ProjectStatus = {
  ACTIVE: 'active',
  PENDING: 'pending',
  DESTROYING: 'destroying',
  DESTROYED: 'destroyed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export type ProjectStatusType = typeof ProjectStatus[keyof typeof ProjectStatus];