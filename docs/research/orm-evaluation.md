# TypeScript ORM Evaluation for Killall-Tofu

**Date**: January 2025  
**Author**: Development Team  
**Issue**: #8 - ORM Discovery

## Executive Summary

After comprehensive evaluation of five major TypeScript ORM solutions, **Drizzle ORM** emerges as the optimal choice for the Killall-Tofu project, with **Kysely** as a strong alternative. This recommendation is based on bundle size, TypeScript support, functional programming compatibility, and alignment with our development standards.

## Comparison Matrix

| Criteria | Drizzle | Prisma | Kysely | TypeORM | MikroORM |
|----------|---------|---------|---------|----------|-----------|
| **NPM Weekly Downloads** | 1.7M | 4.3M | 934K | 2.4M | 232K |
| **Bundle Size** | 🟢 7.4KB | 🔴 400KB+ | 🟢 Small | 🟡 Large | 🟡 Moderate |
| **Dependencies** | 🟢 Zero | 🔴 Binary | 🟢 Minimal | 🔴 Many | 🟡 Focused |
| **TypeScript Support** | 🟢 Excellent | 🟢 Excellent | 🟢 Excellent | 🟡 Good | 🟢 Excellent |
| **Functional Programming** | 🟢 Natural | 🟡 Adaptable | 🟢 Natural | 🟡 Conflicts | 🟡 Adaptable |
| **SQLite Support** | 🟢 Native | 🟢 Full | 🟢 Excellent | 🟢 Good | 🟢 Excellent |
| **Migration Complexity** | 🟢 Simple | 🟡 Moderate | 🟢 Simple | 🟡 Moderate | 🟡 Moderate |
| **Learning Curve** | 🟢 Low | 🟡 Moderate | 🟢 Low | 🟡 Moderate | 🔴 High |
| **Performance** | 🟢 Near raw | 🟡 Good | 🟢 Excellent | 🟡 Good | 🟡 Good |
| **Result Type Compatibility** | 🟢 Natural | 🟡 Wrapper | 🟢 Natural | 🟡 Wrapper | 🟡 Wrapper |

**Legend**: 🟢 Excellent | 🟡 Good/Moderate | 🔴 Poor/Concern

## Detailed Analysis

### 1. Drizzle ORM - 🥇 **RECOMMENDED**

**Strengths:**
- **Minimal footprint**: 7.4KB bundle size with zero dependencies
- **SQL-first approach**: Transparent, predictable behavior
- **TypeScript excellence**: Full type inference and compile-time validation
- **Functional friendly**: Natural composition and Result type integration
- **Performance**: Closest to raw driver performance
- **Tree-shakeable**: Only bundle what you use

**Weaknesses:**
- Newer ecosystem (but rapidly growing)
- Less comprehensive documentation than Prisma
- Fewer advanced ORM features (by design)

**Perfect for Killall-Tofu because:**
- Aligns with functional programming standards in CLAUDE.md
- Minimal impact on Electron app size
- SQL transparency matches our "no magic" preference
- Easy integration with existing Result types

### 2. Kysely - 🥈 **STRONG ALTERNATIVE**

**Strengths:**
- **Type-safe SQL builder**: Not an ORM, just a query builder
- **Functional composition**: Built for functional programming
- **Transparent**: Always know what SQL is generated
- **Lightweight**: Small bundle, minimal dependencies
- **Flexible**: Easy to drop down to raw SQL

**Weaknesses:**
- More verbose than full ORMs
- Manual relationship handling
- Less tooling than mature ORMs

**Good choice if:**
- Maximum control over SQL is priority
- Pure functional approach is critical
- Team has strong SQL knowledge

### 3. Prisma - ❌ **NOT RECOMMENDED**

**Why not:**
- **Bundle size**: 400KB+ is excessive for Electron
- **Binary dependencies**: Rust query engine adds complexity
- **Global state**: Conflicts with functional standards
- **Deployment complexity**: Binary management in Electron

Despite being most popular, Prisma is poorly suited for desktop applications.

### 4. TypeORM - ❌ **NOT RECOMMENDED**

**Why not:**
- **Large bundle**: Significant size impact
- **Decorator pattern**: Conflicts with functional approach
- **Global state**: Repository pattern uses singletons
- **Legacy design**: Older patterns, less modern TypeScript

Better suited for traditional enterprise applications.

### 5. MikroORM - 🟡 **WORTH CONSIDERING**

**Strengths:**
- Modern TypeScript-first design
- Unit of Work pattern for complex operations
- Good balance of features and size

**Weaknesses:**
- Overkill for our use case
- Steeper learning curve
- Smaller community

## Migration Strategy from Current Implementation

### Current State
```typescript
// Current raw SQL implementation
const projectRepo = new ProjectRepository(db);
const result = await projectRepo.create(projectData);
```

### Migration to Drizzle (Recommended)

#### Phase 1: Install and Setup (1 day)
```bash
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit @types/better-sqlite3
```

#### Phase 2: Define Schema (1 day)
```typescript
// src/main/database/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  path: text('path').notNull().unique(),
  name: text('name').notNull(),
  timeout: text('timeout').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  destroyAt: integer('destroy_at', { mode: 'timestamp' })
});
```

#### Phase 3: Repository Adaptation (2 days)
```typescript
// src/main/database/repositories/projects.ts
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { projects } from '../schema';
import type { Result } from '../types';

export class ProjectRepository {
  constructor(private db: ReturnType<typeof drizzle>) {}

  async create(data: NewProject): Promise<Result<Project>> {
    try {
      const [project] = await this.db
        .insert(projects)
        .values(data)
        .returning();
      return { ok: true, value: project };
    } catch (error) {
      return { ok: false, error };
    }
  }

  // Functional helper
  findActive = () => 
    this.db.select().from(projects).where(eq(projects.active, true));
}
```

#### Phase 4: Migration System (1 day)
```typescript
// drizzle.config.ts
export default {
  schema: './src/main/database/schema.ts',
  out: './src/main/database/migrations',
  driver: 'better-sqlite3',
  dbCredentials: {
    url: './killall-tofu.db'
  }
};
```

### Benefits After Migration

1. **Type Safety**: Full compile-time checking
2. **Maintainability**: Schema as code
3. **Developer Experience**: Auto-completion, type inference
4. **Performance**: Minimal overhead vs raw SQL
5. **Testing**: Easier to mock typed interfaces

## Implementation Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Setup** | 1 day | Install Drizzle, configure build |
| **Schema Definition** | 1 day | Convert SQL schemas to Drizzle |
| **Repository Migration** | 2 days | Update repositories with Drizzle |
| **Testing** | 1 day | Update mocks and tests |
| **Documentation** | 1 day | Update docs and examples |
| **Total** | **6 days** | Complete migration |

## Risk Analysis

### Low Risk
- Drizzle is stable and production-ready
- Migration is incremental (can run alongside raw SQL)
- Easy rollback if issues arise
- Strong TypeScript prevents runtime errors

### Mitigation Strategies
- Keep raw SQL implementation during transition
- Extensive testing before full cutover
- Performance benchmarking at each phase

## Code Examples

### Before (Current Raw SQL)
```typescript
async findById(id: string): Promise<Result<Project | null>> {
  try {
    const stmt = this.db.prepare(`
      SELECT * FROM projects WHERE id = ?
    `);
    const project = stmt.get(id) as Project | undefined;
    return { ok: true, value: project || null };
  } catch (error) {
    return { ok: false, error };
  }
}
```

### After (Drizzle)
```typescript
async findById(id: number): Promise<Result<Project | null>> {
  try {
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, id))
      .limit(1);
    return { ok: true, value: project || null };
  } catch (error) {
    return { ok: false, error };
  }
}
```

### Functional Composition with Drizzle
```typescript
// Pure functions that return queries
const activeProjects = () => 
  db.select().from(projects).where(eq(projects.active, true));

const projectsNearTimeout = (hours: number) => 
  activeProjects().where(
    lt(projects.destroyAt, new Date(Date.now() + hours * 3600000))
  );

// Compose queries functionally
const criticalProjects = pipe(
  projectsNearTimeout(1),
  query => query.orderBy(asc(projects.destroyAt)),
  query => query.limit(10)
);
```

## Recommendation

**Adopt Drizzle ORM** for the following reasons:

1. **Perfect fit for Electron**: Minimal bundle size critical for desktop apps
2. **Aligns with standards**: Functional programming patterns in CLAUDE.md
3. **Type safety**: Prevents runtime errors with compile-time checking
4. **Performance**: Near-raw SQL performance with better DX
5. **Future-proof**: Growing ecosystem, active development
6. **Easy migration**: Can coexist with current implementation

## Alternative Recommendation

If maximum SQL control is required, **Kysely** is the best alternative:
- Pure query builder, not an ORM
- Even more functional programming friendly
- Complete SQL transparency
- Smaller learning curve for SQL experts

## Decision Checklist

- [x] Evaluated all major TypeScript ORM options
- [x] Analyzed bundle sizes and performance impacts
- [x] Assessed functional programming compatibility
- [x] Created migration strategy
- [x] Provided code examples
- [x] Risk analysis completed
- [x] Clear recommendation with rationale

## Next Steps

1. **Team Review**: Discuss findings and recommendation
2. **Proof of Concept**: Implement one repository with Drizzle
3. **Performance Testing**: Benchmark vs current implementation
4. **Decision**: Final approval for migration
5. **Implementation**: Execute migration plan

## References

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Drizzle vs Prisma Comparison](https://orm.drizzle.team/drizzle-vs-prisma)
- [Kysely Documentation](https://kysely.dev/)
- [ORM Performance Benchmarks](https://github.com/drizzle-team/drizzle-benchmarks)
- [TypeScript ORM Comparison 2024](https://www.npmtrends.com/drizzle-orm-vs-prisma-vs-typeorm-vs-kysely-vs-mikro-orm)

---

*This research was conducted to evaluate the best ORM solution for the Killall-Tofu project's specific requirements: Electron desktop application, SQLite database, functional programming paradigm, and minimal bundle size.*