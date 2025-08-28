import { Database as SQLiteDatabase } from 'sqlite3';

import { 
  Result, 
  Event, 
  EventRepository, 
  EventType 
} from '../types';

export class EventRepositoryImpl implements EventRepository {
  private db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  // Log a new event to the audit trail
  async log(eventData: Omit<Event, 'id' | 'timestamp'>): Promise<Result<number>> {
    return new Promise((resolve) => {
      const sql = `
        INSERT INTO events (project_id, event_type, details, timestamp)
        VALUES (?, ?, ?, ?)
      `;

      const timestamp = new Date().toISOString();
      const params = [
        eventData.projectId || null,
        eventData.eventType,
        eventData.details || null,
        timestamp
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          resolve({ ok: true, value: this.lastID });
        }
      });
    });
  }

  // Query events with various filters
  async query(filters: {
    projectId?: string;
    eventType?: EventType;
    since?: Date;
    limit?: number;
  }): Promise<Result<Event[]>> {
    return new Promise((resolve) => {
      // Build dynamic query based on filters
      const conditions: string[] = [];
      const params: any[] = [];

      if (filters.projectId) {
        conditions.push('project_id = ?');
        params.push(filters.projectId);
      }

      if (filters.eventType) {
        conditions.push('event_type = ?');
        params.push(filters.eventType);
      }

      if (filters.since) {
        conditions.push('timestamp >= ?');
        params.push(filters.since.toISOString());
      }

      const whereClause = conditions.length > 0 
        ? `WHERE ${conditions.join(' AND ')}`
        : '';

      const limitClause = filters.limit 
        ? `LIMIT ${filters.limit}`
        : '';

      const sql = `
        SELECT id, project_id, event_type, details, timestamp
        FROM events 
        ${whereClause}
        ORDER BY timestamp DESC
        ${limitClause}
      `;

      this.db.all(sql, params, (err, rows: any[]) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          const events = (rows || []).map(row => this.mapRowToEvent(row));
          resolve({ ok: true, value: events });
        }
      });
    });
  }

  // Get recent events for a project (convenience method)
  async getRecentForProject(projectId: string, limit: number = 10): Promise<Result<Event[]>> {
    return this.query({ projectId, limit });
  }

  // Get events by type (convenience method)
  async getByType(eventType: EventType, limit?: number): Promise<Result<Event[]>> {
    return this.query({ eventType, limit });
  }

  // Get events since a specific date (convenience method)
  async getSince(since: Date, limit?: number): Promise<Result<Event[]>> {
    return this.query({ since, limit });
  }

  // Get system-wide events (not tied to a specific project)
  async getSystemEvents(limit?: number): Promise<Result<Event[]>> {
    return new Promise((resolve) => {
      const limitClause = limit ? `LIMIT ${limit}` : '';
      
      const sql = `
        SELECT id, project_id, event_type, details, timestamp
        FROM events 
        WHERE project_id IS NULL
        ORDER BY timestamp DESC
        ${limitClause}
      `;

      this.db.all(sql, [], (err, rows: any[]) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          const events = (rows || []).map(row => this.mapRowToEvent(row));
          resolve({ ok: true, value: events });
        }
      });
    });
  }

  // Cleanup old events (for maintenance)
  async cleanup(olderThan: Date): Promise<Result<number>> {
    return new Promise((resolve) => {
      const sql = 'DELETE FROM events WHERE timestamp < ?';
      
      this.db.run(sql, [olderThan.toISOString()], function(err) {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          resolve({ ok: true, value: this.changes });
        }
      });
    });
  }

  // Helper method to map database row to Event object
  private mapRowToEvent(row: any): Event {
    return {
      id: row.id,
      projectId: row.project_id || undefined,
      eventType: row.event_type as EventType,
      details: row.details || undefined,
      timestamp: new Date(row.timestamp)
    };
  }
}