import { Database as SQLiteDatabase } from 'sqlite3';

import { 
  Result, 
  Project, 
  ProjectRepository, 
  ProjectStatus 
} from '../types';

export class ProjectRepositoryImpl implements ProjectRepository {
  private db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  // Generate UUID for new projects (simple implementation)
  private generateId(): string {
    return 'proj_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // Create a new project
  async create(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Result<Project>> {
    return new Promise((resolve) => {
      const id = this.generateId();
      const now = new Date();
      
      const project: Project = {
        ...projectData,
        id,
        createdAt: now,
        updatedAt: now
      };

      const sql = `
        INSERT INTO projects (id, path, name, config, discovered_at, destroy_at, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        project.id,
        project.path,
        project.name || null,
        project.config,
        project.discoveredAt.toISOString(),
        project.destroyAt.toISOString(),
        project.status,
        project.createdAt.toISOString(),
        project.updatedAt.toISOString()
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          resolve({ ok: true, value: project });
        }
      });
    });
  }

  // Update an existing project
  async update(
    id: string, 
    updates: Partial<Pick<Project, 'name' | 'destroyAt' | 'status' | 'config'>>
  ): Promise<Result<Project>> {
    return new Promise((resolve) => {
      // First, get the existing project
      this.findById(id).then((findResult) => {
        if (!findResult.ok) {
          resolve(findResult);
          return;
        }

        if (!findResult.value) {
          resolve({ ok: false, error: new Error(`Project with id ${id} not found`) });
          return;
        }

        const existing = findResult.value;
        const updated: Project = {
          ...existing,
          ...updates,
          updatedAt: new Date()
        };

        const sql = `
          UPDATE projects 
          SET name = ?, destroy_at = ?, status = ?, config = ?, updated_at = ?
          WHERE id = ?
        `;

        const params = [
          updated.name || null,
          updated.destroyAt.toISOString(),
          updated.status,
          updated.config,
          updated.updatedAt.toISOString(),
          id
        ];

        this.db.run(sql, params, function(err) {
          if (err) {
            resolve({ ok: false, error: err });
          } else if (this.changes === 0) {
            resolve({ ok: false, error: new Error(`Project with id ${id} not found`) });
          } else {
            resolve({ ok: true, value: updated });
          }
        });
      });
    });
  }

  // Delete a project
  async delete(id: string): Promise<Result<void>> {
    return new Promise((resolve) => {
      const sql = 'DELETE FROM projects WHERE id = ?';

      this.db.run(sql, [id], function(err) {
        if (err) {
          resolve({ ok: false, error: err });
        } else if (this.changes === 0) {
          resolve({ ok: false, error: new Error(`Project with id ${id} not found`) });
        } else {
          resolve({ ok: true, value: undefined });
        }
      });
    });
  }

  // Find project by ID
  async findById(id: string): Promise<Result<Project | null>> {
    return new Promise((resolve) => {
      const sql = `
        SELECT id, path, name, config, discovered_at, destroy_at, status, created_at, updated_at
        FROM projects 
        WHERE id = ?
      `;

      this.db.get(sql, [id], (err, row: any) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else if (!row) {
          resolve({ ok: true, value: null });
        } else {
          const project = this.mapRowToProject(row);
          resolve({ ok: true, value: project });
        }
      });
    });
  }

  // Find project by filesystem path
  async findByPath(path: string): Promise<Result<Project | null>> {
    return new Promise((resolve) => {
      const sql = `
        SELECT id, path, name, config, discovered_at, destroy_at, status, created_at, updated_at
        FROM projects 
        WHERE path = ?
      `;

      this.db.get(sql, [path], (err, row: any) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else if (!row) {
          resolve({ ok: true, value: null });
        } else {
          const project = this.mapRowToProject(row);
          resolve({ ok: true, value: project });
        }
      });
    });
  }

  // Find all active projects (not destroyed, failed, or cancelled)
  async findActive(): Promise<Result<Project[]>> {
    return new Promise((resolve) => {
      const sql = `
        SELECT id, path, name, config, discovered_at, destroy_at, status, created_at, updated_at
        FROM projects 
        WHERE status IN ('active', 'pending', 'destroying')
        ORDER BY destroy_at ASC
      `;

      this.db.all(sql, [], (err, rows: any[]) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          const projects = (rows || []).map(row => this.mapRowToProject(row));
          resolve({ ok: true, value: projects });
        }
      });
    });
  }

  // Find projects by status
  async findByStatus(status: ProjectStatus): Promise<Result<Project[]>> {
    return new Promise((resolve) => {
      const sql = `
        SELECT id, path, name, config, discovered_at, destroy_at, status, created_at, updated_at
        FROM projects 
        WHERE status = ?
        ORDER BY created_at DESC
      `;

      this.db.all(sql, [status], (err, rows: any[]) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          const projects = (rows || []).map(row => this.mapRowToProject(row));
          resolve({ ok: true, value: projects });
        }
      });
    });
  }

  // Helper method to map database row to Project object
  private mapRowToProject(row: any): Project {
    return {
      id: row.id,
      path: row.path,
      name: row.name || undefined,
      config: row.config,
      discoveredAt: new Date(row.discovered_at),
      destroyAt: new Date(row.destroy_at),
      status: row.status as ProjectStatus,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}