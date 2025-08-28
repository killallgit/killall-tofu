/**
 * Drizzle ORM Schema Definitions
 * Exports all table schemas, types, and relations for the Killall-Tofu database
 */

// Table schemas
export * from './projects';
export * from './executions';
export * from './events';
export * from './configs';

// Table relations
export * from './relations';

// Re-export tables for convenient access
export { projects } from './projects';
export { executions } from './executions';
export { events } from './events';
export { appConfigurations } from './configs';

// Re-export relations
export { 
  projectsRelations,
  executionsRelations,
  eventsRelations 
} from './relations';