/**
 * Performance Benchmark Suite for Drizzle ORM vs Raw SQL
 * Compares performance metrics between implementations
 */

import { performance } from 'perf_hooks';
import * as path from 'path';
import * as fs from 'fs/promises';
import { createDatabaseFactory } from '../src/main/database/factory';
import { Result } from '../src/shared/types';
import { parseDuration } from '../src/main/services/configValidator';

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  memoryUsed: number;
  implementation: 'raw-sql' | 'drizzle';
}

interface ComparisonReport {
  timestamp: Date;
  rawSql: BenchmarkResult[];
  drizzle: BenchmarkResult[];
  comparison: {
    operation: string;
    rawSqlAvg: number;
    drizzleAvg: number;
    difference: number;
    percentChange: number;
    withinTarget: boolean;
  }[];
  summary: {
    totalOperations: number;
    withinTargetCount: number;
    averagePerformanceDiff: number;
    recommendation: string;
  };
}

class PerformanceBenchmark {
  private dbPath: string;
  private results: BenchmarkResult[] = [];

  constructor() {
    this.dbPath = path.join(__dirname, '../benchmark-test.db');
  }

  /**
   * Run a single benchmark operation multiple times
   */
  private async runBenchmark(
    name: string,
    operation: () => Promise<any>,
    iterations: number,
    implementation: 'raw-sql' | 'drizzle'
  ): Promise<BenchmarkResult> {
    const times: number[] = [];
    const memBefore = process.memoryUsage().heapUsed;

    // Warmup runs
    for (let i = 0; i < 10; i++) {
      await operation();
    }

    // Actual benchmark runs
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await operation();
      const end = performance.now();
      times.push(end - start);
    }

    const memAfter = process.memoryUsage().heapUsed;
    const memoryUsed = memAfter - memBefore;

    const totalTime = times.reduce((sum, t) => sum + t, 0);
    const averageTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    return {
      operation: name,
      iterations,
      totalTime,
      averageTime,
      minTime,
      maxTime,
      memoryUsed,
      implementation
    };
  }

  /**
   * Benchmark insert operations
   */
  private async benchmarkInserts(iterations: number): Promise<BenchmarkResult> {
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    if (!dbResult.ok) throw dbResult.error;
    const db = dbResult.value;

    const implementation = factory.useDrizzle ? 'drizzle' : 'raw-sql';
    
    const result = await this.runBenchmark(
      'Single Insert',
      async () => {
        const projectId = `bench_${Date.now()}_${Math.random()}`;
        await db.projects.create({
          path: `/test/path/${projectId}`,
          name: `Benchmark Project ${projectId}`,
          status: 'active',
          discoveredAt: new Date(),
          destroyAt: new Date(Date.now() + 3600000),
          config: JSON.stringify({
            version: 1,
            timeout: '2 hours',
            command: 'terraform destroy -auto-approve'
          })
        });
      },
      iterations,
      implementation
    );

    await db.disconnect();
    return result;
  }

  /**
   * Benchmark query operations
   */
  private async benchmarkQueries(iterations: number): Promise<BenchmarkResult> {
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    if (!dbResult.ok) throw dbResult.error;
    const db = dbResult.value;

    const implementation = factory.useDrizzle ? 'drizzle' : 'raw-sql';

    // Create test data
    const testProjects: string[] = [];
    for (let i = 0; i < 100; i++) {
      const projectId = `query_test_${i}`;
      const createResult = await db.projects.create({
        path: `/test/path/${projectId}`,
        name: `Query Test Project ${i}`,
        status: 'active',
        discoveredAt: new Date(),
        destroyAt: new Date(Date.now() + 3600000),
        config: JSON.stringify({
          version: 1,
          timeout: '2 hours',
          command: 'terraform destroy -auto-approve'
        })
      });
      if (createResult.ok) {
        testProjects.push(createResult.value.id);
      }
    }

    const result = await this.runBenchmark(
      'Query by ID',
      async () => {
        const randomId = testProjects[Math.floor(Math.random() * testProjects.length)];
        await db.projects.findById(randomId);
      },
      iterations,
      implementation
    );

    await db.disconnect();
    return result;
  }

  /**
   * Benchmark update operations
   */
  private async benchmarkUpdates(iterations: number): Promise<BenchmarkResult> {
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    if (!dbResult.ok) throw dbResult.error;
    const db = dbResult.value;

    const implementation = factory.useDrizzle ? 'drizzle' : 'raw-sql';

    // Create test data
    const projectId = `update_test_${Date.now()}`;
    const createResult = await db.projects.create({
      path: `/test/path/${projectId}`,
      name: `Update Test Project`,
      status: 'active',
      discoveredAt: new Date(),
      destroyAt: new Date(Date.now() + 3600000),
      config: JSON.stringify({
        version: 1,
        timeout: '2 hours',
        command: 'terraform destroy -auto-approve'
      })
    });

    if (!createResult.ok) throw createResult.error;

    const result = await this.runBenchmark(
      'Single Update',
      async () => {
        await db.projects.update(projectId, {
          status: Math.random() > 0.5 ? 'active' : 'destroying'
        });
      },
      iterations,
      implementation
    );

    await db.disconnect();
    return result;
  }

  /**
   * Benchmark delete operations
   */
  private async benchmarkDeletes(iterations: number): Promise<BenchmarkResult> {
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    if (!dbResult.ok) throw dbResult.error;
    const db = dbResult.value;

    const implementation = factory.useDrizzle ? 'drizzle' : 'raw-sql';

    // Create test data for deletion
    const projectIds: string[] = [];
    for (let i = 0; i < iterations; i++) {
      const projectId = `delete_test_${Date.now()}_${i}`;
      const createResult = await db.projects.create({
        path: `/test/path/${projectId}`,
        name: `Delete Test Project ${i}`,
        status: 'active',
        discoveredAt: new Date(),
        destroyAt: new Date(Date.now() + 3600000),
        config: JSON.stringify({
          version: 1,
          timeout: '2 hours',
          command: 'terraform destroy -auto-approve'
        })
      });
      if (createResult.ok) {
        projectIds.push(createResult.value.id);
      }
    }

    const result = await this.runBenchmark(
      'Single Delete',
      async () => {
        if (projectIds.length > 0) {
          const id = projectIds.pop()!;
          await db.projects.delete(id);
        }
      },
      Math.min(iterations, projectIds.length),
      implementation
    );

    await db.disconnect();
    return result;
  }

  /**
   * Benchmark complex queries
   */
  private async benchmarkComplexQueries(iterations: number): Promise<BenchmarkResult> {
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    if (!dbResult.ok) throw dbResult.error;
    const db = dbResult.value;

    const implementation = factory.useDrizzle ? 'drizzle' : 'raw-sql';

    // Create test data with events and executions
    for (let i = 0; i < 50; i++) {
      const projectId = `complex_test_${i}`;
      const createResult = await db.projects.create({
        path: `/test/path/${projectId}`,
        name: `Complex Test Project ${i}`,
        status: i % 3 === 0 ? 'active' : i % 3 === 1 ? 'destroying' : 'destroyed',
        discoveredAt: new Date(),
        destroyAt: new Date(Date.now() + (i * 3600000)),
        config: JSON.stringify({
          version: 1,
          timeout: '2 hours',
          command: 'terraform destroy -auto-approve'
        })
      });

      if (createResult.ok) {
        // Add some events
        for (let j = 0; j < 5; j++) {
          await db.events.log({
            projectId,
            eventType: j % 2 === 0 ? 'discovered' : 'warning',
            details: `Event ${j} for project ${i}`
          });
        }
      }
    }

    const result = await this.runBenchmark(
      'Complex Query (findActive)',
      async () => {
        await db.projects.findActive(); // Find active projects
      },
      iterations,
      implementation
    );

    await db.disconnect();
    return result;
  }

  /**
   * Benchmark batch operations
   */
  private async benchmarkBatchOperations(batchSize: number): Promise<BenchmarkResult> {
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    if (!dbResult.ok) throw dbResult.error;
    const db = dbResult.value;

    const implementation = factory.useDrizzle ? 'drizzle' : 'raw-sql';

    const result = await this.runBenchmark(
      `Batch Insert (${batchSize} records)`,
      async () => {
        // Batch insert using transactions
        await db.transaction(async (tx) => {
          for (let i = 0; i < batchSize; i++) {
            const projectId = `batch_${Date.now()}_${i}`;
            await db.projects.create({
              path: `/test/path/${projectId}`,
              name: `Batch Project ${i}`,
              status: 'active',
              discoveredAt: new Date(),
              destroyAt: new Date(Date.now() + 3600000),
              config: JSON.stringify({
                version: 1,
                timeout: '2 hours',
                command: 'terraform destroy -auto-approve'
              })
            });
          }
        });
      },
      10, // Run batch operation 10 times
      implementation
    );

    await db.disconnect();
    return result;
  }

  /**
   * Set up database with migrations
   */
  private async setupDatabase(): Promise<void> {
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    if (!dbResult.ok) throw dbResult.error;
    const db = dbResult.value;
    
    // For raw SQL implementation, run migrations
    if (!factory.useDrizzle) {
      const { DatabaseService } = await import('../src/main/database/index');
      const dbService = new DatabaseService(this.dbPath);
      await dbService.connect();
      const migrateResult = await dbService.migrate();
      if (!migrateResult.ok) {
        throw new Error(`Migration failed: ${migrateResult.error.message}`);
      }
      await dbService.disconnect();
    }
    // For Drizzle, tables are created automatically via the schema
    
    await db.disconnect();
  }

  /**
   * Run all benchmarks for one implementation
   */
  public async runFullSuite(implementation: 'raw-sql' | 'drizzle'): Promise<BenchmarkResult[]> {
    console.log(`\n🏃 Running benchmarks for ${implementation}...`);
    
    // Set environment variable
    process.env.USE_DRIZZLE = implementation === 'drizzle' ? 'true' : 'false';
    
    // Clean up database before starting
    await this.cleanup();
    
    // Set up database with migrations
    await this.setupDatabase();
    
    const results: BenchmarkResult[] = [];

    // Run each benchmark
    console.log('  📝 Testing inserts...');
    results.push(await this.benchmarkInserts(100));
    
    console.log('  🔍 Testing queries...');
    results.push(await this.benchmarkQueries(100));
    
    console.log('  ✏️  Testing updates...');
    results.push(await this.benchmarkUpdates(100));
    
    console.log('  🗑️  Testing deletes...');
    results.push(await this.benchmarkDeletes(50));
    
    console.log('  🔄 Testing complex queries...');
    results.push(await this.benchmarkComplexQueries(50));
    
    console.log('  📦 Testing batch operations...');
    results.push(await this.benchmarkBatchOperations(100));

    return results;
  }

  /**
   * Clean up test database
   */
  private async cleanup(): Promise<void> {
    try {
      await fs.unlink(this.dbPath);
    } catch {
      // File doesn't exist, that's fine
    }
  }

  /**
   * Generate comparison report
   */
  public generateReport(rawSqlResults: BenchmarkResult[], drizzleResults: BenchmarkResult[]): ComparisonReport {
    const comparison = rawSqlResults.map((rawResult, index) => {
      const drizzleResult = drizzleResults[index];
      const difference = drizzleResult.averageTime - rawResult.averageTime;
      const percentChange = (difference / rawResult.averageTime) * 100;
      const withinTarget = Math.abs(percentChange) <= 5; // Within 5% target

      return {
        operation: rawResult.operation,
        rawSqlAvg: rawResult.averageTime,
        drizzleAvg: drizzleResult.averageTime,
        difference,
        percentChange,
        withinTarget
      };
    });

    const withinTargetCount = comparison.filter(c => c.withinTarget).length;
    const averagePerformanceDiff = comparison.reduce((sum, c) => sum + c.percentChange, 0) / comparison.length;

    const recommendation = withinTargetCount === comparison.length
      ? '✅ READY FOR PRODUCTION: All operations within performance targets'
      : withinTargetCount >= comparison.length * 0.8
      ? '⚠️ MOSTLY READY: Most operations within targets, consider optimization'
      : '❌ NOT READY: Performance targets not met, optimization required';

    return {
      timestamp: new Date(),
      rawSql: rawSqlResults,
      drizzle: drizzleResults,
      comparison,
      summary: {
        totalOperations: comparison.length,
        withinTargetCount,
        averagePerformanceDiff,
        recommendation
      }
    };
  }

  /**
   * Print formatted report
   */
  public printReport(report: ComparisonReport): void {
    console.log('\n' + '='.repeat(80));
    console.log('                    PERFORMANCE BENCHMARK REPORT');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);
    console.log('\n📊 OPERATION COMPARISON:');
    console.log('-'.repeat(80));
    
    const tableData = report.comparison.map(c => ({
      Operation: c.operation,
      'Raw SQL (ms)': c.rawSqlAvg.toFixed(3),
      'Drizzle (ms)': c.drizzleAvg.toFixed(3),
      'Diff (ms)': c.difference.toFixed(3),
      'Change (%)': `${c.percentChange > 0 ? '+' : ''}${c.percentChange.toFixed(1)}%`,
      'Status': c.withinTarget ? '✅' : '❌'
    }));

    console.table(tableData);

    console.log('\n📈 SUMMARY:');
    console.log('-'.repeat(80));
    console.log(`Total Operations Tested: ${report.summary.totalOperations}`);
    console.log(`Within Target (±5%): ${report.summary.withinTargetCount}/${report.summary.totalOperations}`);
    console.log(`Average Performance Difference: ${report.summary.averagePerformanceDiff > 0 ? '+' : ''}${report.summary.averagePerformanceDiff.toFixed(2)}%`);
    console.log(`\n${report.summary.recommendation}`);
    console.log('='.repeat(80));
  }

  /**
   * Save report to file
   */
  public async saveReport(report: ComparisonReport): Promise<void> {
    const reportPath = path.join(__dirname, '../benchmark-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);
  }
}

/**
 * Main benchmark runner
 */
async function main() {
  console.log('🚀 Starting Drizzle ORM Performance Benchmarks');
  console.log('=' .repeat(80));
  
  const benchmark = new PerformanceBenchmark();
  
  try {
    // Run benchmarks for both implementations
    const rawSqlResults = await benchmark.runFullSuite('raw-sql');
    const drizzleResults = await benchmark.runFullSuite('drizzle');
    
    // Generate and display report
    const report = benchmark.generateReport(rawSqlResults, drizzleResults);
    benchmark.printReport(report);
    
    // Save report to file
    await benchmark.saveReport(report);
    
    // Exit with appropriate code
    process.exit(report.summary.withinTargetCount === report.comparison.length ? 0 : 1);
  } catch (error) {
    console.error('❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { PerformanceBenchmark, BenchmarkResult, ComparisonReport };