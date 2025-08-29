import { eq, desc, and, or, gte, lte, sql } from 'drizzle-orm';
import { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';

import { projects, Project, NewProject } from '../schema/projects';
import { 
  Result,
  ProjectRepository,
  ProjectStatus,
  Project as IProject
} from '../../types';

import { BaseDrizzleRepository } from './base';

/**
 * Drizzle implementation of ProjectRepository.
 * Maintains Result type pattern and functional programming standards.
 */
export class DrizzleProjectRepository 
  extends BaseDrizzleRepository<Project> 
  implements ProjectRepository {
  
  constructor(db: BetterSQLite3Database) {
    super(db);
  }

  /**
   * Create a new project with auto-generated UUID.
   */
  async create(
    projectData: Omit<IProject, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<Result<IProject>> {
    return this.executeQuery(async () => {
      const id = this.generateId('proj');
      const now = this.getCurrentTimestamp();
      
      const newProject: NewProject = {
        id,
        path: projectData.path,
        name: projectData.name || null,
        config: projectData.config,
        discoveredAt: projectData.discoveredAt,
        destroyAt: projectData.destroyAt,
        status: projectData.status,
        createdAt: now,
        updatedAt: now
      };

      const [inserted] = await this.db
        .insert(projects)
        .values(newProject)
        .returning();

      return this.mapToInterface(inserted);
    });
  }

  /**
   * Update an existing project with partial data.
   */
  async update(
    id: string,
    updates: Partial<Pick<IProject, 'name' | 'destroyAt' | 'status' | 'config'>>
  ): Promise<Result<IProject>> {
    return this.executeQuery(async () => {
      const updateData: Partial<NewProject> = {
        ...updates,
        updatedAt: this.getCurrentTimestamp()
      };

      // Remove undefined values to prevent overwriting with null
      Object.keys(updateData).forEach(key => {
        if (updateData[key as keyof typeof updateData] === undefined) {
          delete updateData[key as keyof typeof updateData];
        }
      });

      const [updated] = await this.db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();

      if (!updated) {
        throw new Error(`Project with id ${id} not found`);
      }

      return this.mapToInterface(updated);
    });
  }

  /**
   * Delete a project by ID.
   */
  async delete(id: string): Promise<Result<void>> {
    return this.executeQuery(async () => {
      const result = await this.db
        .delete(projects)
        .where(eq(projects.id, id));

      // Check if any rows were affected
      const changes = (result as any).changes || 0;
      if (changes === 0) {
        throw new Error(`Project with id ${id} not found`);
      }

      return undefined;
    });
  }

  /**
   * Find a project by ID.
   */
  async findById(id: string): Promise<Result<IProject | null>> {
    return this.executeQuery(async () => {
      const [project] = await this.db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      return project ? this.mapToInterface(project) : null;
    });
  }

  /**
   * Find a project by filesystem path.
   */
  async findByPath(path: string): Promise<Result<IProject | null>> {
    return this.executeQuery(async () => {
      const [project] = await this.db
        .select()
        .from(projects)
        .where(eq(projects.path, path))
        .limit(1);

      return project ? this.mapToInterface(project) : null;
    });
  }

  /**
   * Find all active projects.
   */
  async findActive(): Promise<Result<IProject[]>> {
    return this.executeQuery(async () => {
      const activeProjects = await this.db
        .select()
        .from(projects)
        .where(eq(projects.status, 'active'))
        .orderBy(desc(projects.destroyAt));

      return activeProjects.map(p => this.mapToInterface(p));
    });
  }

  /**
   * Find projects by status.
   */
  async findByStatus(status: ProjectStatus): Promise<Result<IProject[]>> {
    return this.executeQuery(async () => {
      const foundProjects = await this.db
        .select()
        .from(projects)
        .where(eq(projects.status, status))
        .orderBy(desc(projects.createdAt));

      return foundProjects.map(p => this.mapToInterface(p));
    });
  }

  /**
   * Find projects scheduled to be destroyed within the specified hours.
   * Useful for finding projects that need warning notifications.
   */
  async findExpiring(hours: number): Promise<Result<IProject[]>> {
    return this.executeQuery(async () => {
      const now = new Date();
      const expiryTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

      const expiringProjects = await this.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.status, 'active'),
            lte(projects.destroyAt, expiryTime),
            gte(projects.destroyAt, now)
          )
        )
        .orderBy(projects.destroyAt);

      return expiringProjects.map(p => this.mapToInterface(p));
    });
  }

  /**
   * Find projects that are past their destroy time and need execution.
   */
  async findOverdue(): Promise<Result<IProject[]>> {
    return this.executeQuery(async () => {
      const now = new Date();

      const overdueProjects = await this.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.status, 'active'),
            lte(projects.destroyAt, now)
          )
        )
        .orderBy(projects.destroyAt);

      return overdueProjects.map(p => this.mapToInterface(p));
    });
  }

  /**
   * Get all projects with pagination support.
   */
  async list(limit?: number, offset?: number): Promise<Result<IProject[]>> {
    return this.executeQuery(async () => {
      const baseQuery = this.db
        .select()
        .from(projects)
        .orderBy(desc(projects.createdAt));

      const allProjects = await (
        limit !== undefined && offset !== undefined
          ? baseQuery.limit(limit).offset(offset)
          : limit !== undefined
          ? baseQuery.limit(limit)
          : offset !== undefined
          ? baseQuery.offset(offset)
          : baseQuery
      );

      return allProjects.map(p => this.mapToInterface(p));
    });
  }

  /**
   * Count projects by status.
   */
  async countByStatus(): Promise<Result<Record<string, number>>> {
    return this.executeQuery(async () => {
      const statuses = ['active', 'pending', 'destroying', 'destroyed', 'failed', 'cancelled'];
      const counts: Record<string, number> = {};

      for (const status of statuses) {
        const [result] = await this.db
          .select({ count: sql<number>`COUNT(*)` })
          .from(projects)
          .where(eq(projects.status, status as any));
        
        counts[status] = result?.count || 0;
      }

      return counts;
    });
  }

  /**
   * Map Drizzle project type to interface type.
   * Ensures consistent interface regardless of implementation.
   */
  private mapToInterface(project: Project): IProject {
    return {
      id: project.id,
      path: project.path,
      name: project.name || undefined,
      config: project.config,
      discoveredAt: project.discoveredAt,
      destroyAt: project.destroyAt,
      status: project.status as ProjectStatus,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt
    };
  }
}

/**
 * Functional query builders for composable project queries.
 */
export const projectQueries = {
  /**
   * Build a query for active projects.
   */
  active: () => eq(projects.status, 'active'),

  /**
   * Build a query for projects by status.
   */
  byStatus: (status: string) => eq(projects.status, status as any),

  /**
   * Build a query for projects expiring within hours.
   */
  expiringWithin: (hours: number) => {
    const now = new Date();
    const expiryTime = new Date(now.getTime() + hours * 60 * 60 * 1000);
    return and(
      eq(projects.status, 'active'),
      lte(projects.destroyAt, expiryTime),
      gte(projects.destroyAt, now)
    );
  },

  /**
   * Build a query for overdue projects.
   */
  overdue: () => {
    const now = new Date();
    return and(
      eq(projects.status, 'active'),
      lte(projects.destroyAt, now)
    );
  }
};