import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { projects } from './projects';

/**
 * Events table: Audit log for all significant system events
 * Provides comprehensive tracking of project lifecycle and system operations
 */
export const events = sqliteTable('events', {
  // Auto-incrementing primary key
  id: integer('id').primaryKey({ autoIncrement: true }),
  
  // Optional foreign key to projects table (can be NULL for system events)
  projectId: text('project_id')
    .references(() => projects.id, { onDelete: 'set null' }),
  
  // Type of event that occurred
  eventType: text('event_type', {
    enum: [
      'discovered',   // New project found
      'registered',   // Project registered for destruction
      'warning',      // Warning notification sent
      'destroying',   // Destruction process started
      'destroyed',    // Successfully destroyed
      'failed',       // Destruction failed
      'cancelled',    // Destruction cancelled by user
      'extended',     // Timer extended by user
      'error'        // System error occurred
    ]
  }).notNull(),
  
  // Optional JSON-serialized event details
  details: text('details'),
  
  // Event timestamp with automatic default
  timestamp: integer('timestamp', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
}, (table) => ({
  // Performance indexes for common query patterns
  projectIdx: index('idx_events_project').on(table.projectId),
  eventTypeIdx: index('idx_events_type').on(table.eventType),
  timestampIdx: index('idx_events_timestamp').on(table.timestamp)
}));

// TypeScript type inference for select operations
export type Event = typeof events.$inferSelect;

// TypeScript type inference for insert operations
export type NewEvent = typeof events.$inferInsert;

// Event type enum for type safety
export const EventType = {
  DISCOVERED: 'discovered',
  REGISTERED: 'registered',
  WARNING: 'warning',
  DESTROYING: 'destroying',
  DESTROYED: 'destroyed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXTENDED: 'extended',
  ERROR: 'error'
} as const;

export type EventTypeType = typeof EventType[keyof typeof EventType];