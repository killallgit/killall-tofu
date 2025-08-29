import { eq, desc, and, gte, lte, isNull, or } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { BaseDrizzleRepository } from './base';
import { events, Event, NewEvent } from '../schema/events';
import { 
  Result,
  EventRepository,
  EventType,
  Event as IEvent
} from '../../types';

/**
 * Drizzle implementation of EventRepository.
 * Manages application event logging and querying.
 */
export class DrizzleEventRepository 
  extends BaseDrizzleRepository<Event> 
  implements EventRepository {
  
  constructor(db: BetterSQLite3Database) {
    super(db);
  }

  /**
   * Log a new event to the database.
   */
  async log(
    eventData: Omit<IEvent, 'id' | 'timestamp'>
  ): Promise<Result<number>> {
    return this.executeQuery(async () => {
      const newEvent: NewEvent = {
        projectId: eventData.projectId || null,
        eventType: eventData.eventType,
        details: eventData.details || null,
        timestamp: this.getCurrentTimestamp()
      };

      const [inserted] = await this.db
        .insert(events)
        .values(newEvent)
        .returning({ id: events.id });

      if (!inserted || !inserted.id) {
        throw new Error('Failed to log event');
      }

      return inserted.id;
    });
  }

  /**
   * Query events with flexible filtering options.
   */
  async query(filters: {
    projectId?: string;
    eventType?: EventType;
    since?: Date;
    until?: Date;
    limit?: number;
  }): Promise<Result<IEvent[]>> {
    return this.executeQuery(async () => {
      // Build WHERE conditions
      const conditions = [];

      if (filters.projectId !== undefined) {
        conditions.push(eq(events.projectId, filters.projectId));
      }

      if (filters.eventType !== undefined) {
        conditions.push(eq(events.eventType, filters.eventType));
      }

      if (filters.since !== undefined) {
        conditions.push(gte(events.timestamp, filters.since));
      }

      if (filters.until !== undefined) {
        conditions.push(lte(events.timestamp, filters.until));
      }

      // Build query with conditions
      const baseQuery = conditions.length > 0
        ? this.db.select().from(events).where(and(...conditions))
        : this.db.select().from(events);
      
      // Add ordering
      const orderedQuery = baseQuery.orderBy(desc(events.timestamp));

      // Apply limit if specified
      const foundEvents = await (
        filters.limit !== undefined
          ? orderedQuery.limit(filters.limit)
          : orderedQuery
      );

      return foundEvents.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Get recent events across all projects.
   */
  async getRecent(limit: number = 100): Promise<Result<IEvent[]>> {
    return this.executeQuery(async () => {
      const recentEvents = await this.db
        .select()
        .from(events)
        .orderBy(desc(events.timestamp))
        .limit(limit);

      return recentEvents.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Get events for a specific project.
   */
  async getByProject(
    projectId: string,
    limit?: number
  ): Promise<Result<IEvent[]>> {
    return this.executeQuery(async () => {
      const baseQuery = this.db
        .select()
        .from(events)
        .where(eq(events.projectId, projectId))
        .orderBy(desc(events.timestamp));

      const projectEvents = await (
        limit !== undefined
          ? baseQuery.limit(limit)
          : baseQuery
      );

      return projectEvents.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Get events by type.
   */
  async getByType(
    eventType: EventType,
    limit?: number
  ): Promise<Result<IEvent[]>> {
    return this.executeQuery(async () => {
      const baseQuery = this.db
        .select()
        .from(events)
        .where(eq(events.eventType, eventType))
        .orderBy(desc(events.timestamp));

      const typeEvents = await (
        limit !== undefined
          ? baseQuery.limit(limit)
          : baseQuery
      );

      return typeEvents.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Get global events (not associated with any project).
   */
  async getGlobalEvents(limit?: number): Promise<Result<IEvent[]>> {
    return this.executeQuery(async () => {
      const baseQuery = this.db
        .select()
        .from(events)
        .where(isNull(events.projectId))
        .orderBy(desc(events.timestamp));

      const globalEvents = await (
        limit !== undefined
          ? baseQuery.limit(limit)
          : baseQuery
      );

      return globalEvents.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Count events by type for statistics.
   */
  async countByType(): Promise<Result<Record<string, number>>> {
    return this.executeQuery(async () => {
      const eventTypes: EventType[] = [
        'discovered', 'registered', 'warning', 'destroying', 
        'destroyed', 'failed', 'cancelled', 'extended', 'error'
      ];
      const counts: Record<string, number> = {};

      for (const eventType of eventTypes) {
        const [result] = await this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(events)
          .where(eq(events.eventType, eventType));
        
        counts[eventType] = result?.count || 0;
      }

      return counts;
    });
  }

  /**
   * Get event statistics for a time period.
   */
  async getStats(since: Date, until?: Date): Promise<Result<{
    total: number;
    byType: Record<string, number>;
    byProject: Record<string, number>;
  }>> {
    return this.executeQuery(async () => {
      const conditions = [gte(events.timestamp, since)];
      if (until) {
        conditions.push(lte(events.timestamp, until));
      }

      const periodEvents = await this.db
        .select()
        .from(events)
        .where(and(...conditions));

      const total = periodEvents.length;

      // Count by type
      const byType: Record<string, number> = {};
      periodEvents.forEach(e => {
        byType[e.eventType] = (byType[e.eventType] || 0) + 1;
      });

      // Count by project
      const byProject: Record<string, number> = {};
      periodEvents.forEach(e => {
        if (e.projectId) {
          byProject[e.projectId] = (byProject[e.projectId] || 0) + 1;
        }
      });

      return { total, byType, byProject };
    });
  }

  /**
   * Clean up old events to prevent database bloat.
   */
  async cleanup(olderThanDays: number): Promise<Result<number>> {
    return this.executeQuery(async () => {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await this.db
        .delete(events)
        .where(lte(events.timestamp, cutoffDate));

      return (result as any).changes || 0;
    });
  }

  /**
   * Get error events for debugging.
   */
  async getErrors(limit: number = 50): Promise<Result<IEvent[]>> {
    return this.executeQuery(async () => {
      const errorEvents = await this.db
        .select()
        .from(events)
        .where(
          or(
            eq(events.eventType, 'error'),
            eq(events.eventType, 'failed')
          )
        )
        .orderBy(desc(events.timestamp))
        .limit(limit);

      return errorEvents.map(e => this.mapToInterface(e));
    });
  }

  /**
   * Map Drizzle event type to interface type.
   */
  private mapToInterface(event: Event): IEvent {
    return {
      id: event.id,
      projectId: event.projectId || undefined,
      eventType: event.eventType as EventType,
      details: event.details || undefined,
      timestamp: event.timestamp
    };
  }
}

// Import required for SQL template literal
import { sql } from 'drizzle-orm';

/**
 * Functional query builders for composable event queries.
 */
export const eventQueries = {
  /**
   * Build a query for events by project.
   */
  byProject: (projectId: string) => eq(events.projectId, projectId),

  /**
   * Build a query for events by type.
   */
  byType: (eventType: EventType) => eq(events.eventType, eventType),

  /**
   * Build a query for global events.
   */
  global: () => isNull(events.projectId),

  /**
   * Build a query for events in time range.
   */
  inRange: (since: Date, until?: Date) => {
    const conditions = [gte(events.timestamp, since)];
    if (until) {
      conditions.push(lte(events.timestamp, until));
    }
    return and(...conditions);
  },

  /**
   * Build a query for error events.
   */
  errors: () => or(
    eq(events.eventType, 'error'),
    eq(events.eventType, 'failed')
  ),

  /**
   * Build a query for lifecycle events.
   */
  lifecycle: () => or(
    eq(events.eventType, 'discovered'),
    eq(events.eventType, 'registered'),
    eq(events.eventType, 'destroying'),
    eq(events.eventType, 'destroyed'),
    eq(events.eventType, 'cancelled')
  )
};