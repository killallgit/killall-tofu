/**
 * Memory Leak Detection for Drizzle ORM Implementation
 * Tests for memory leaks and resource cleanup
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { createDatabaseFactory } from '../src/main/database/factory';

interface MemorySnapshot {
  timestamp: Date;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  iteration: number;
}

class MemoryLeakDetector {
  private snapshots: MemorySnapshot[] = [];
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(__dirname, '../memory-test.db');
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(iteration: number): MemorySnapshot {
    if (global.gc) {
      global.gc(); // Force garbage collection if available
    }

    const mem = process.memoryUsage();
    return {
      timestamp: new Date(),
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      iteration
    };
  }

  /**
   * Test for memory leaks in connection handling
   */
  public async testConnectionLeaks(iterations: number = 100): Promise<void> {
    console.log(`\n🔌 Testing connection handling (${iterations} iterations)...`);
    
    for (let i = 0; i < iterations; i++) {
      const factory = createDatabaseFactory(this.dbPath);
      const dbResult = await factory.createDatabase();
      
      if (!dbResult.ok) {
        throw new Error(`Failed to create database: ${dbResult.error.message}`);
      }

      const db = dbResult.value;

      // Perform some operations
      await db.projects.findAll();
      await db.events.getRecent(10);
      
      // Disconnect
      await db.disconnect();

      // Take snapshot every 10 iterations
      if (i % 10 === 0) {
        this.snapshots.push(this.takeSnapshot(i));
        process.stdout.write(`\r  Progress: ${i}/${iterations}`);
      }
    }

    console.log(`\r  ✅ Completed ${iterations} connection cycles`);
  }

  /**
   * Test for memory leaks in CRUD operations
   */
  public async testCrudLeaks(iterations: number = 1000): Promise<void> {
    console.log(`\n📝 Testing CRUD operations (${iterations} iterations)...`);
    
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    
    if (!dbResult.ok) {
      throw new Error(`Failed to create database: ${dbResult.error.message}`);
    }

    const db = dbResult.value;
    const projectIds: string[] = [];

    for (let i = 0; i < iterations; i++) {
      // Create
      const projectId = `mem_test_${Date.now()}_${i}`;
      const createResult = await db.projects.create({
        id: projectId,
        path: `/test/path/${projectId}`,
        name: `Memory Test Project ${i}`,
        status: 'active',
        destroyAt: new Date(Date.now() + 3600000),
        config: {
          version: 1,
          timeout: '2 hours',
          command: 'terraform destroy -auto-approve'
        }
      });

      if (createResult.ok) {
        projectIds.push(createResult.value.id);

        // Read
        await db.projects.findById(projectId);

        // Update
        await db.projects.update(projectId, {
          status: 'destroying'
        });

        // Log event
        await db.events.log({
          projectId,
          eventType: 'destroying',
          details: `Iteration ${i}`
        });
      }

      // Delete older projects to prevent unbounded growth
      if (projectIds.length > 100) {
        const oldId = projectIds.shift()!;
        await db.projects.delete(oldId);
      }

      // Take snapshot every 100 iterations
      if (i % 100 === 0) {
        this.snapshots.push(this.takeSnapshot(i));
        process.stdout.write(`\r  Progress: ${i}/${iterations}`);
      }
    }

    // Clean up remaining projects
    for (const id of projectIds) {
      await db.projects.delete(id);
    }

    await db.disconnect();
    console.log(`\r  ✅ Completed ${iterations} CRUD operations`);
  }

  /**
   * Test for memory leaks in transactions
   */
  public async testTransactionLeaks(iterations: number = 100): Promise<void> {
    console.log(`\n💰 Testing transactions (${iterations} iterations)...`);
    
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    
    if (!dbResult.ok) {
      throw new Error(`Failed to create database: ${dbResult.error.message}`);
    }

    const db = dbResult.value;

    for (let i = 0; i < iterations; i++) {
      // Successful transaction
      await db.transaction(async (tx) => {
        for (let j = 0; j < 10; j++) {
          const projectId = `tx_test_${i}_${j}`;
          await db.projects.create({
            id: projectId,
            path: `/test/path/${projectId}`,
            name: `Transaction Test ${i}-${j}`,
            status: 'active',
            destroyAt: new Date(Date.now() + 3600000),
            config: {
              version: 1,
              timeout: '2 hours',
              command: 'terraform destroy -auto-approve'
            }
          });
        }
      });

      // Failed transaction (should rollback)
      try {
        await db.transaction(async (tx) => {
          await db.projects.create({
            id: `tx_fail_${i}`,
            path: `/test/path/fail`,
            name: `Failing Transaction ${i}`,
            status: 'active',
            destroyAt: new Date(Date.now() + 3600000),
            config: {
              version: 1,
              timeout: '2 hours',
              command: 'terraform destroy -auto-approve'
            }
          });
          throw new Error('Intentional transaction failure');
        });
      } catch {
        // Expected to fail
      }

      // Take snapshot every 10 iterations
      if (i % 10 === 0) {
        this.snapshots.push(this.takeSnapshot(i));
        process.stdout.write(`\r  Progress: ${i}/${iterations}`);
      }
    }

    await db.disconnect();
    console.log(`\r  ✅ Completed ${iterations} transaction cycles`);
  }

  /**
   * Test for memory leaks in query operations
   */
  public async testQueryLeaks(iterations: number = 500): Promise<void> {
    console.log(`\n🔍 Testing query operations (${iterations} iterations)...`);
    
    const factory = createDatabaseFactory(this.dbPath);
    const dbResult = await factory.createDatabase();
    
    if (!dbResult.ok) {
      throw new Error(`Failed to create database: ${dbResult.error.message}`);
    }

    const db = dbResult.value;

    // Create test data
    for (let i = 0; i < 100; i++) {
      await db.projects.create({
        id: `query_test_${i}`,
        path: `/test/path/${i}`,
        name: `Query Test Project ${i}`,
        status: i % 2 === 0 ? 'active' : 'destroying',
        destroyAt: new Date(Date.now() + (i * 3600000)),
        config: {
          version: 1,
          timeout: '2 hours',
          command: 'terraform destroy -auto-approve'
        }
      });

      // Add events
      for (let j = 0; j < 10; j++) {
        await db.events.log({
          projectId: `query_test_${i}`,
          eventType: 'discovered',
          details: `Event ${j}`
        });
      }
    }

    // Run queries
    for (let i = 0; i < iterations; i++) {
      // Various query types
      await db.projects.findAll();
      await db.projects.findActive();
      await db.projects.findByStatus('active');
      await db.projects.findExpiring(3600000);
      await db.projects.findOverdue();
      
      await db.events.getRecent(100);
      await db.events.query({
        eventType: 'discovered',
        limit: 50
      });

      // Take snapshot every 50 iterations
      if (i % 50 === 0) {
        this.snapshots.push(this.takeSnapshot(i));
        process.stdout.write(`\r  Progress: ${i}/${iterations}`);
      }
    }

    await db.disconnect();
    console.log(`\r  ✅ Completed ${iterations} query operations`);
  }

  /**
   * Analyze memory snapshots for leaks
   */
  public analyzeResults(): { hasLeak: boolean; report: string } {
    if (this.snapshots.length < 3) {
      return {
        hasLeak: false,
        report: 'Insufficient data for analysis'
      };
    }

    // Calculate memory growth rate
    const firstSnapshot = this.snapshots[0];
    const lastSnapshot = this.snapshots[this.snapshots.length - 1];
    const middleIndex = Math.floor(this.snapshots.length / 2);
    const middleSnapshot = this.snapshots[middleIndex];

    const totalGrowth = lastSnapshot.heapUsed - firstSnapshot.heapUsed;
    const growthRate = totalGrowth / (lastSnapshot.iteration - firstSnapshot.iteration);
    
    // Check if memory is growing linearly (potential leak)
    const firstHalfGrowth = middleSnapshot.heapUsed - firstSnapshot.heapUsed;
    const secondHalfGrowth = lastSnapshot.heapUsed - middleSnapshot.heapUsed;
    const growthRatio = secondHalfGrowth / firstHalfGrowth;

    // Memory leak detection criteria
    const hasLeak = growthRate > 10000 && growthRatio > 0.8; // Growing by >10KB per iteration consistently

    let report = '\n📊 MEMORY ANALYSIS REPORT\n';
    report += '='.repeat(60) + '\n';
    report += `Total Snapshots: ${this.snapshots.length}\n`;
    report += `Total Iterations: ${lastSnapshot.iteration}\n`;
    report += `Initial Heap: ${(firstSnapshot.heapUsed / 1024 / 1024).toFixed(2)} MB\n`;
    report += `Final Heap: ${(lastSnapshot.heapUsed / 1024 / 1024).toFixed(2)} MB\n`;
    report += `Total Growth: ${(totalGrowth / 1024 / 1024).toFixed(2)} MB\n`;
    report += `Growth Rate: ${(growthRate / 1024).toFixed(2)} KB/iteration\n`;
    report += `Growth Ratio (2nd half / 1st half): ${growthRatio.toFixed(2)}\n`;
    report += '\n';

    if (hasLeak) {
      report += '⚠️ WARNING: Potential memory leak detected!\n';
      report += 'Memory is growing linearly with iterations.\n';
    } else {
      report += '✅ No memory leaks detected.\n';
      report += 'Memory usage is stable or growing sub-linearly.\n';
    }

    // Add detailed snapshot table
    report += '\n📈 Memory Snapshots:\n';
    report += '-'.repeat(60) + '\n';
    report += 'Iteration | Heap Used (MB) | Growth (MB)\n';
    report += '-'.repeat(60) + '\n';

    let previousHeap = firstSnapshot.heapUsed;
    for (const snapshot of this.snapshots) {
      const growth = snapshot.heapUsed - previousHeap;
      report += `${snapshot.iteration.toString().padEnd(9)} | `;
      report += `${(snapshot.heapUsed / 1024 / 1024).toFixed(2).padEnd(14)} | `;
      report += `${growth >= 0 ? '+' : ''}${(growth / 1024 / 1024).toFixed(2)}\n`;
      previousHeap = snapshot.heapUsed;
    }

    return { hasLeak, report };
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
   * Run full memory leak test suite
   */
  public async runFullSuite(implementation: 'raw-sql' | 'drizzle'): Promise<{ hasLeak: boolean; report: string }> {
    console.log(`\n🔬 Memory Leak Detection for ${implementation}`);
    console.log('='.repeat(60));
    
    // Set implementation
    process.env.USE_DRIZZLE = implementation === 'drizzle' ? 'true' : 'false';
    
    // Clean up before starting
    await this.cleanup();
    this.snapshots = [];

    try {
      // Run all memory tests
      await this.testConnectionLeaks(50);
      await this.testCrudLeaks(500);
      await this.testTransactionLeaks(50);
      await this.testQueryLeaks(200);
      
      // Analyze results
      const analysis = this.analyzeResults();
      console.log(analysis.report);
      
      // Clean up
      await this.cleanup();
      
      return analysis;
    } catch (error) {
      console.error('❌ Memory test failed:', error);
      throw error;
    }
  }
}

/**
 * Main memory test runner
 */
async function main() {
  console.log('🚀 Starting Memory Leak Detection');
  console.log('=' .repeat(60));
  console.log('Note: Run with --expose-gc flag for accurate results');
  console.log('Example: node --expose-gc scripts/memory-test.js');
  console.log();

  const detector = new MemoryLeakDetector();
  let hasAnyLeak = false;

  try {
    // Test raw SQL implementation
    const rawSqlResult = await detector.runFullSuite('raw-sql');
    if (rawSqlResult.hasLeak) hasAnyLeak = true;

    // Test Drizzle implementation
    const drizzleResult = await detector.runFullSuite('drizzle');
    if (drizzleResult.hasLeak) hasAnyLeak = true;

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('FINAL SUMMARY');
    console.log('='.repeat(60));
    
    if (hasAnyLeak) {
      console.log('❌ Memory leaks detected in one or more implementations');
      process.exit(1);
    } else {
      console.log('✅ No memory leaks detected in either implementation');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Memory test suite failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { MemoryLeakDetector };