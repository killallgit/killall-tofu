// Example usage of the DatabaseService
// This file demonstrates how to use the database service and can be used for testing
// 
// ⚠️  TEMPORARY FILE - TO BE REMOVED BEFORE PRODUCTION
// This example file should be removed once proper tests are implemented
// See GitHub Issue #5 for cleanup tracking

import { DatabaseService } from './index';

async function exampleUsage(): Promise<void> {
  // Create database service instance
  const db = new DatabaseService();

  try {
    // Connect to database
    console.log('Connecting to database...');
    const connectResult = await db.connect();
    if (!connectResult.ok) {
      console.error('Failed to connect:', connectResult.error.message);
      return;
    }
    console.log('✅ Connected successfully');

    // Run migrations
    console.log('Running migrations...');
    const migrateResult = await db.migrate();
    if (!migrateResult.ok) {
      console.error('Failed to migrate:', migrateResult.error.message);
      return;
    }
    console.log(`✅ Applied ${migrateResult.value} migrations`);

    // Health check
    const healthResult = await db.healthCheck();
    if (!healthResult.ok) {
      console.error('Health check failed:', healthResult.error.message);
      return;
    }
    console.log('✅ Health check passed:', healthResult.value);

    // Example: Create a project
    const projectData = {
      path: '/Users/test/terraform/dev',
      name: 'Development Environment',
      config: JSON.stringify({
        version: 1,
        timeout: '2 hours',
        command: 'terraform destroy -auto-approve'
      }),
      discoveredAt: new Date(),
      destroyAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours from now
      status: 'active' as const
    };

    console.log('Creating project...');
    const createResult = await db.projects.create(projectData);
    if (!createResult.ok) {
      console.error('Failed to create project:', createResult.error.message);
      return;
    }
    console.log('✅ Project created:', createResult.value.id);

    // Example: Log an event
    console.log('Logging event...');
    const eventResult = await db.events.log({
      projectId: createResult.value.id,
      eventType: 'discovered',
      details: JSON.stringify({ source: 'file_watcher' })
    });
    if (!eventResult.ok) {
      console.error('Failed to log event:', eventResult.error.message);
      return;
    }
    console.log('✅ Event logged with ID:', eventResult.value);

    // Example: Find active projects
    console.log('Finding active projects...');
    const activeResult = await db.projects.findActive();
    if (!activeResult.ok) {
      console.error('Failed to find active projects:', activeResult.error.message);
      return;
    }
    console.log(`✅ Found ${activeResult.value.length} active projects`);

    // Example: Create an execution record
    console.log('Creating execution record...');
    const executionData = {
      projectId: createResult.value.id,
      command: 'terraform destroy -auto-approve',
      workingDir: projectData.path,
      startedAt: new Date(),
      status: 'running' as const,
      attemptNumber: 1
    };

    const execResult = await db.executions.create(executionData);
    if (!execResult.ok) {
      console.error('Failed to create execution:', execResult.error.message);
      return;
    }
    console.log('✅ Execution created with ID:', execResult.value);

    // Example: Transaction usage
    console.log('Testing transaction...');
    const transactionResult = await db.transaction(async (trx) => {
      // Update project status
      const updateResult = await db.projects.update(createResult.value.id, {
        status: 'destroying'
      });
      if (!updateResult.ok) {
        throw updateResult.error;
      }

      // Log status change event
      const logResult = await db.events.log({
        projectId: createResult.value.id,
        eventType: 'destroying',
        details: JSON.stringify({ reason: 'timer_expired' })
      });
      if (!logResult.ok) {
        throw logResult.error;
      }

      return { updated: updateResult.value, eventId: logResult.value };
    });

    if (!transactionResult.ok) {
      console.error('Transaction failed:', transactionResult.error.message);
      return;
    }
    console.log('✅ Transaction completed successfully');

    // Get database statistics
    const statsResult = await db.getStats();
    if (!statsResult.ok) {
      console.error('Failed to get stats:', statsResult.error.message);
      return;
    }
    console.log('✅ Database stats:', statsResult.value);

    // Cleanup example - normally you wouldn't delete immediately
    console.log('Cleaning up example data...');
    const deleteResult = await db.projects.delete(createResult.value.id);
    if (!deleteResult.ok) {
      console.error('Failed to delete project:', deleteResult.error.message);
      return;
    }
    console.log('✅ Example project deleted');

  } finally {
    // Always disconnect
    console.log('Disconnecting...');
    const disconnectResult = await db.disconnect();
    if (!disconnectResult.ok) {
      console.error('Failed to disconnect:', disconnectResult.error.message);
    } else {
      console.log('✅ Disconnected successfully');
    }
  }
}

// Run example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}

export { exampleUsage };