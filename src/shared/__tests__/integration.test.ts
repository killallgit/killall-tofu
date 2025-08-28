/**
 * Integration tests for the testing foundation and shared types
 */

import { Ok, Err, map, combine } from '../utils/result';
import { parseDuration, formatDuration } from '../utils/duration';
import { validateProjectConfig } from '../utils/validation';
import { MockDatabase, createTestProject } from '../mocks/database';
import { MockScheduler } from '../mocks/scheduler';
import { MockExecutor } from '../mocks/executor';
import { MockNotifier, createInfoNotification } from '../mocks/notifier';
import { SAMPLE_PROJECTS } from '../fixtures/projects/sample-projects';

describe('Testing Foundation Integration', () => {
  it('should integrate Result types with duration parsing', () => {
    const durationResult = parseDuration('2 hours');
    expect(durationResult.ok).toBe(true);
    
    const mappedResult = map(durationResult, duration => duration.toHours());
    expect(mappedResult.ok).toBe(true);
    if (mappedResult.ok) {
      expect(mappedResult.value).toBe(2);
    }
  });

  it('should validate project configs and handle results', () => {
    const validConfig = {
      version: 1,
      timeout: '1 hour',
      name: 'test-project',
    };

    const result = validateProjectConfig(validConfig);
    expect(result.ok).toBe(true);
    
    if (result.ok) {
      expect(result.value.version).toBe(1);
      expect(result.value.timeout).toBe('1 hour');
      expect(result.value.name).toBe('test-project');
    }
  });

  it('should integrate all mock services for a complete workflow', async () => {
    // Set up services
    const database = new MockDatabase();
    const scheduler = new MockScheduler();
    const executor = new MockExecutor();
    const notifier = new MockNotifier();

    // Create and store a project
    const project = createTestProject({
      path: '/test/integration-project',
      config: {
        version: 1,
        timeout: '30 minutes',
        name: 'integration-test',
        tags: ['integration', 'test'],
      },
    });

    const storeResult = await database.projects.create(project);
    expect(storeResult.ok).toBe(true);

    // Start scheduler and schedule the project
    await scheduler.start();
    const scheduleResult = await scheduler.schedule(project);
    expect(scheduleResult.ok).toBe(true);

    // Verify project is scheduled
    const scheduledProjects = await scheduler.getScheduled();
    expect(scheduledProjects.ok).toBe(true);
    if (scheduledProjects.ok) {
      expect(scheduledProjects.value).toHaveLength(1);
      expect(scheduledProjects.value[0].id).toBe(project.id);
    }

    // Execute the project
    const executionResult = await executor.execute(project);
    expect(executionResult.ok).toBe(true);

    // Send a notification
    const notification = createInfoNotification(
      'Integration Test',
      'Integration test completed successfully'
    );
    const notifyResult = await notifier.notify(notification);
    expect(notifyResult.ok).toBe(true);

    // Verify notification was logged
    const logs = notifier.getNotificationLog();
    expect(logs).toHaveLength(1);
    expect(logs[0].message.title).toBe('Integration Test');

    // Clean up
    await scheduler.stop();
    executor.forceCompleteAll('completed', 0);
  });

  it('should work with sample fixture data', () => {
    expect(SAMPLE_PROJECTS.basicProject).toBeDefined();
    expect(SAMPLE_PROJECTS.terraformProject).toBeDefined();
    expect(SAMPLE_PROJECTS.dockerProject).toBeDefined();

    // Test that sample projects have valid configurations
    Object.values(SAMPLE_PROJECTS).forEach(project => {
      expect(project.id).toBeDefined();
      expect(project.path).toBeDefined();
      expect(project.config.version).toBe(1);
      expect(project.config.timeout).toBeDefined();
      expect(project.discoveredAt).toBeInstanceOf(Date);
      expect(project.destroyAt).toBeInstanceOf(Date);
    });
  });

  it('should combine multiple Results', () => {
    const results = [
      parseDuration('1 hour'),
      parseDuration('30 minutes'),
      parseDuration('15 seconds'),
    ] as const;

    const combined = combine(results);
    expect(combined.ok).toBe(true);

    if (combined.ok) {
      expect(combined.value).toHaveLength(3);
      expect(combined.value[0].toHours()).toBe(1);
      expect(combined.value[1].milliseconds).toBe(30 * 60 * 1000);
      expect(combined.value[2].milliseconds).toBe(15 * 1000);
    }
  });

  it('should handle error cases in integration', () => {
    // Test validation error
    const invalidConfig = {
      version: 2, // Invalid version
      timeout: 'invalid duration',
    };

    const validationResult = validateProjectConfig(invalidConfig);
    expect(validationResult.ok).toBe(false);

    // Test duration parsing error
    const durationResult = parseDuration('invalid duration');
    expect(durationResult.ok).toBe(false);

    // Combine should fail if any Result is Err
    const mixedResults = [
      Ok('success'),
      Err(new Error('failure')),
      Ok('another success'),
    ] as const;

    const combinedResult = combine(mixedResults);
    expect(combinedResult.ok).toBe(false);
  });

  it('should demonstrate functional programming patterns', () => {
    // Chain operations using Result type
    const process = (input: string) => {
      const step1 = parseDuration(input);
      const step2 = map(step1, duration => duration.milliseconds);
      const step3 = map(step2, ms => ms / 1000);
      return map(step3, seconds => `${seconds} seconds`);
    };

    // Note: Pipeline operator not available, so we'll use nested calls
    const result = parseDuration('2 minutes');
    const msResult = map(result, duration => duration.milliseconds);
    const secondsResult = map(msResult, ms => ms / 1000);
    const stringResult = map(secondsResult, seconds => `${seconds} seconds`);

    expect(stringResult.ok).toBe(true);
    if (stringResult.ok) {
      expect(stringResult.value).toBe('120 seconds');
    }
  });

  it('should format durations consistently', () => {
    const testCases = [
      { ms: 0, expected: '0ms' },
      { ms: 1000, expected: '1s' },
      { ms: 61000, expected: '1m 1s' },
      { ms: 3661000, expected: '1h 1m 1s' },
    ];

    testCases.forEach(({ ms, expected }) => {
      expect(formatDuration(ms)).toBe(expected);
    });
  });
});