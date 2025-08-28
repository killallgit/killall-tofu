# Drizzle ORM Migration Plan for Killall-Tofu

## Overview

This document outlines the migration strategy from our current raw SQL implementation to Drizzle ORM, maintaining our functional programming standards and Result type patterns.

## Why Drizzle?

- **7.4KB bundle size** - Critical for Electron performance
- **Zero dependencies** - No bloat or security concerns
- **TypeScript-first** - Full type inference and safety
- **Functional friendly** - Natural composition patterns
- **SQL transparency** - No hidden magic

## Migration Phases

### Phase 1: Setup & Configuration (Day 1)

#### 1.1 Install Dependencies
```bash
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3
```

#### 1.2 Create Drizzle Configuration
```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/main/database/schema/*',
  out: './src/main/database/migrations/drizzle',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: process.env.DATABASE_URL || './killall-tofu.db'
  },
  verbose: true,
  strict: true
} satisfies Config;
```

#### 1.3 Update Package.json Scripts
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate:sqlite",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:push": "drizzle-kit push:sqlite"
  }
}
```

### Phase 2: Schema Definition (Day 2)

#### 2.1 Projects Schema
```typescript
// src/main/database/schema/projects.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  path: text('path').notNull().unique(),
  name: text('name').notNull(),
  timeout: text('timeout').notNull(),
  command: text('command').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  destroyAt: integer('destroy_at', { mode: 'timestamp' })
});

// Type exports
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
```

#### 2.2 Executions Schema
```typescript
// src/main/database/schema/executions.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { projects } from './projects';

export const executions = sqliteTable('executions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  status: text('status', { 
    enum: ['pending', 'running', 'completed', 'failed', 'cancelled'] 
  }).notNull(),
  output: text('output'),
  error: text('error'),
  exitCode: integer('exit_code'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export type Execution = typeof executions.$inferSelect;
export type NewExecution = typeof executions.$inferInsert;
```

#### 2.3 Events Schema
```typescript
// src/main/database/schema/events.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { projects } from './projects';

export const events = sqliteTable('events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id')
    .references(() => projects.id, { onDelete: 'cascade' }),
  type: text('type', {
    enum: ['created', 'configured', 'executed', 'destroyed', 'error']
  }).notNull(),
  message: text('message').notNull(),
  metadata: text('metadata', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
```

### Phase 3: Repository Migration (Days 3-4)

#### 3.1 Database Connection with Result Types
```typescript
// src/main/database/connection.ts
import { drizzle, BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import type { Result } from './types';

export type DrizzleDB = BetterSQLite3Database<typeof schema>;

export const createDatabase = (path: string): Result<DrizzleDB> => {
  try {
    const sqlite = new Database(path);
    const db = drizzle(sqlite, { schema });
    return { ok: true, value: db };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
};
```

#### 3.2 Migrated Project Repository
```typescript
// src/main/database/repositories/projects.ts
import { eq, and, lt, gte } from 'drizzle-orm';
import type { DrizzleDB } from '../connection';
import { projects, type Project, type NewProject } from '../schema/projects';
import type { Result } from '../types';

export class ProjectRepository {
  constructor(private db: DrizzleDB) {}

  // Pure function for active projects query
  private activeProjectsQuery = () =>
    this.db.select().from(projects).where(eq(projects.active, true));

  async create(data: NewProject): Promise<Result<Project>> {
    try {
      const [project] = await this.db
        .insert(projects)
        .values(data)
        .returning();
      return { ok: true, value: project };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  async findById(id: number): Promise<Result<Project | null>> {
    try {
      const [project] = await this.db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);
      return { ok: true, value: project || null };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  async findByPath(path: string): Promise<Result<Project | null>> {
    try {
      const [project] = await this.db
        .select()
        .from(projects)
        .where(eq(projects.path, path))
        .limit(1);
      return { ok: true, value: project || null };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  async findActive(): Promise<Result<Project[]>> {
    try {
      const activeProjects = await this.activeProjectsQuery();
      return { ok: true, value: activeProjects };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  async findExpiring(withinHours: number): Promise<Result<Project[]>> {
    try {
      const deadline = new Date(Date.now() + withinHours * 3600000);
      const expiringProjects = await this.db
        .select()
        .from(projects)
        .where(
          and(
            eq(projects.active, true),
            lt(projects.destroyAt, deadline),
            gte(projects.destroyAt, new Date())
          )
        )
        .orderBy(projects.destroyAt);
      return { ok: true, value: expiringProjects };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  async update(id: number, data: Partial<NewProject>): Promise<Result<Project>> {
    try {
      const [updated] = await this.db
        .update(projects)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(projects.id, id))
        .returning();
      
      if (!updated) {
        return { ok: false, error: new Error('Project not found') };
      }
      
      return { ok: true, value: updated };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }

  async delete(id: number): Promise<Result<boolean>> {
    try {
      const result = await this.db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning();
      return { ok: true, value: result.length > 0 };
    } catch (error) {
      return { ok: false, error: error as Error };
    }
  }
}
```

#### 3.3 Functional Query Builders
```typescript
// src/main/database/queries/projects.ts
import { eq, and, lt, gte, desc, asc } from 'drizzle-orm';
import type { DrizzleDB } from '../connection';
import { projects } from '../schema/projects';

// Pure functions that return query builders
export const queries = {
  active: (db: DrizzleDB) =>
    db.select().from(projects).where(eq(projects.active, true)),

  byTimeout: (db: DrizzleDB, timeout: string) =>
    db.select().from(projects).where(eq(projects.timeout, timeout)),

  expiring: (db: DrizzleDB, hours: number) => {
    const deadline = new Date(Date.now() + hours * 3600000);
    return db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.active, true),
          lt(projects.destroyAt, deadline),
          gte(projects.destroyAt, new Date())
        )
      );
  },

  recent: (db: DrizzleDB, limit = 10) =>
    db.select().from(projects).orderBy(desc(projects.createdAt)).limit(limit),

  // Composable query modifiers
  withOrdering: (field: keyof typeof projects, direction: 'asc' | 'desc' = 'asc') =>
    (query: any) => direction === 'asc' 
      ? query.orderBy(asc(projects[field]))
      : query.orderBy(desc(projects[field])),

  withLimit: (limit: number) => (query: any) => query.limit(limit),

  withOffset: (offset: number) => (query: any) => query.offset(offset)
};

// Function composition example
export const getPagedActiveProjects = (
  db: DrizzleDB,
  page: number,
  pageSize: number
) => {
  const offset = (page - 1) * pageSize;
  return queries.active(db)
    .orderBy(desc(projects.createdAt))
    .limit(pageSize)
    .offset(offset);
};
```

### Phase 4: Testing Updates (Day 5)

#### 4.1 Mock Database with Drizzle
```typescript
// src/shared/mocks/database.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from '../../main/database/schema';

export const createMockDatabase = () => {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  
  // Run migrations for test database
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      timeout TEXT NOT NULL,
      command TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at INTEGER NOT NULL DEFAULT CURRENT_TIMESTAMP,
      destroy_at INTEGER
    )
  `);
  
  return db;
};
```

#### 4.2 Repository Tests
```typescript
// src/main/database/repositories/__tests__/projects.test.ts
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ProjectRepository } from '../projects';
import { createMockDatabase } from '../../../shared/mocks/database';

describe('ProjectRepository with Drizzle', () => {
  let repository: ProjectRepository;
  let db: ReturnType<typeof createMockDatabase>;

  beforeEach(() => {
    db = createMockDatabase();
    repository = new ProjectRepository(db);
  });

  it('should create project with Result type', async () => {
    const projectData = {
      path: '/test/project',
      name: 'Test Project',
      timeout: '2 hours',
      command: 'rm -rf',
      destroyAt: new Date(Date.now() + 7200000)
    };

    const result = await repository.create(projectData);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBeDefined();
      expect(result.value.path).toBe('/test/project');
    }
  });

  it('should handle errors with Result type', async () => {
    const invalidData = {} as any;
    const result = await repository.create(invalidData);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
```

### Phase 5: Performance Validation (Day 6)

#### 5.1 Benchmark Script
```typescript
// scripts/benchmark-drizzle.ts
import { performance } from 'perf_hooks';
import { createDatabase } from '../src/main/database/connection';
import { ProjectRepository } from '../src/main/database/repositories/projects';

async function benchmark() {
  const dbResult = createDatabase('./benchmark.db');
  if (!dbResult.ok) throw dbResult.error;

  const repository = new ProjectRepository(dbResult.value);
  const iterations = 1000;

  // Benchmark inserts
  const insertStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await repository.create({
      path: `/test/project-${i}`,
      name: `Project ${i}`,
      timeout: '2 hours',
      command: 'echo test'
    });
  }
  const insertTime = performance.now() - insertStart;

  // Benchmark queries
  const queryStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    await repository.findActive();
  }
  const queryTime = performance.now() - queryStart;

  console.log(`Insert ${iterations} records: ${insertTime.toFixed(2)}ms`);
  console.log(`Query ${iterations} times: ${queryTime.toFixed(2)}ms`);
  console.log(`Average insert: ${(insertTime / iterations).toFixed(2)}ms`);
  console.log(`Average query: ${(queryTime / iterations).toFixed(2)}ms`);
}

benchmark().catch(console.error);
```

## Migration Checklist

### Pre-Migration
- [ ] Team approval for Drizzle adoption
- [ ] Backup existing database
- [ ] Create feature branch: `feature/drizzle-migration`

### Implementation
- [ ] Install Drizzle dependencies
- [ ] Define database schemas
- [ ] Migrate ProjectRepository
- [ ] Migrate ExecutionRepository
- [ ] Migrate EventRepository
- [ ] Update database connection logic
- [ ] Create functional query builders
- [ ] Update mock implementations
- [ ] Update all tests

### Validation
- [ ] All tests passing
- [ ] Performance benchmarks acceptable
- [ ] TypeScript compilation clean
- [ ] Linting passes
- [ ] Bundle size verified (<10KB increase)

### Deployment
- [ ] Migration documentation complete
- [ ] Team code review
- [ ] PR approved and merged
- [ ] Production deployment plan

## Rollback Strategy

If issues arise, rollback is straightforward:

1. **Keep parallel implementations** during transition
2. **Feature flag** to switch between raw SQL and Drizzle
3. **Data compatibility** - Drizzle uses same database structure
4. **Quick revert** - Simply switch feature flag or revert commit

```typescript
// Feature flag approach
const usesDrizzle = process.env.USE_DRIZZLE === 'true';

export const createProjectRepository = (db: any) => {
  return usesDrizzle 
    ? new DrizzleProjectRepository(db)
    : new SqliteProjectRepository(db);
};
```

## Success Metrics

- **Bundle size increase**: <10KB
- **Query performance**: Within 5% of raw SQL
- **Type safety**: 100% type coverage
- **Developer experience**: Reduced boilerplate by 40%
- **Test coverage**: Maintained at 85%+

## Timeline Summary

| Day | Focus | Deliverables |
|-----|-------|--------------|
| 1 | Setup | Dependencies, configuration |
| 2 | Schema | All table definitions |
| 3-4 | Repositories | Migrated with Result types |
| 5 | Testing | Updated mocks and tests |
| 6 | Validation | Benchmarks, review |

**Total: 6 working days** for complete migration

## Conclusion

Drizzle ORM provides the perfect balance for Killall-Tofu:
- Minimal bundle impact (7.4KB)
- Excellent TypeScript support
- Natural functional programming patterns
- Maintains our Result type architecture
- Easy migration path

The migration can be done incrementally with low risk and clear rollback options.