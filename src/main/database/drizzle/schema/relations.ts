import { relations } from 'drizzle-orm';
import { projects } from './projects';
import { executions } from './executions';
import { events } from './events';

/**
 * Define relationships between tables for query builder support
 * These relations enable JOIN operations and nested queries
 */

// Projects can have many executions and events
export const projectsRelations = relations(projects, ({ many }) => ({
  executions: many(executions),
  events: many(events)
}));

// Executions belong to a project
export const executionsRelations = relations(executions, ({ one }) => ({
  project: one(projects, {
    fields: [executions.projectId],
    references: [projects.id]
  })
}));

// Events optionally belong to a project
export const eventsRelations = relations(events, ({ one }) => ({
  project: one(projects, {
    fields: [events.projectId],
    references: [projects.id]
  })
}));