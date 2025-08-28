/**
 * Mock notifier service implementation for testing and parallel development.
 */

import { EventEmitter } from 'events';

import { NotifierService, NotificationMessage, NotificationType, Result } from '../types';
import { Ok, Err } from '../utils/result';

interface NotificationLog {
  message: NotificationMessage;
  deliveredAt: Date;
  success: boolean;
  error?: string;
}

export class MockNotifier extends EventEmitter implements NotifierService {
  private notificationLog: NotificationLog[] = [];
  private subscribers: Array<(_message: NotificationMessage) => void> = [];
  private config: {
    deliveryDelay: number;
    failureRate: number;
    maxRetries: number;
    enableLogging: boolean;
  };

  constructor(config: Partial<MockNotifier['config']> = {}) {
    super();
    this.config = {
      deliveryDelay: 100, // ms
      failureRate: 0.02, // 2% failure rate
      maxRetries: 3,
      enableLogging: true,
      ...config,
    };
  }

  async notify(message: NotificationMessage): Promise<Result<void>> {
    // Validate message
    const validationResult = this.validateMessage(message);
    if (!validationResult.ok) {
      return validationResult;
    }

    // Simulate delivery delay
    await new Promise(resolve => setTimeout(resolve, this.config.deliveryDelay));

    // Simulate delivery failure
    const shouldFail = Math.random() < this.config.failureRate;
    
    if (shouldFail) {
      const error = 'Simulated notification delivery failure';
      
      if (this.config.enableLogging) {
        this.notificationLog.push({
          message,
          deliveredAt: new Date(),
          success: false,
          error,
        });
      }

      return Err(new Error(error));
    }

    // Successful delivery
    if (this.config.enableLogging) {
      this.notificationLog.push({
        message,
        deliveredAt: new Date(),
        success: true,
      });
    }

    // Notify subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(message);
      } catch (error) {
        console.error('Error in notification subscriber:', error);
      }
    });

    this.emit('notification_sent', { message });
    return Ok(void 0);
  }

  subscribe(callback: (_message: NotificationMessage) => void): void {
    this.subscribers.push(callback);
  }

  // Private validation
  private validateMessage(message: NotificationMessage): Result<void> {
    if (!message.title || message.title.trim().length === 0) {
      return Err(new Error('Notification title is required'));
    }

    if (!message.body || message.body.trim().length === 0) {
      return Err(new Error('Notification body is required'));
    }

    if (!message.type || !this.isValidNotificationType(message.type)) {
      return Err(new Error('Invalid notification type'));
    }

    return Ok(void 0);
  }

  private isValidNotificationType(type: string): type is NotificationType {
    return ['info', 'success', 'warning', 'error'].includes(type);
  }

  // Testing utilities
  getNotificationLog(): NotificationLog[] {
    return [...this.notificationLog];
  }

  getNotificationsByType(type: NotificationType): NotificationLog[] {
    return this.notificationLog.filter(log => log.message.type === type);
  }

  getSuccessfulNotifications(): NotificationLog[] {
    return this.notificationLog.filter(log => log.success);
  }

  getFailedNotifications(): NotificationLog[] {
    return this.notificationLog.filter(log => !log.success);
  }

  getTotalNotifications(): number {
    return this.notificationLog.length;
  }

  getSuccessRate(): number {
    if (this.notificationLog.length === 0) return 1;
    const successful = this.getSuccessfulNotifications().length;
    return successful / this.notificationLog.length;
  }

  clearLog(): void {
    this.notificationLog = [];
  }

  clearSubscribers(): void {
    this.subscribers = [];
  }

  getSubscriberCount(): number {
    return this.subscribers.length;
  }

  // Simulate notification with specific outcome
  async simulateNotification(
    message: NotificationMessage, 
    forceSuccess: boolean
  ): Promise<Result<void>> {
    const originalFailureRate = this.config.failureRate;
    this.config.failureRate = forceSuccess ? 0 : 1;
    
    const result = await this.notify(message);
    
    this.config.failureRate = originalFailureRate;
    return result;
  }

  // Batch notification utility
  async notifyBatch(messages: NotificationMessage[]): Promise<Result<void>[]> {
    const results = [];
    for (const message of messages) {
      results.push(await this.notify(message));
    }
    return results;
  }
}

// Factory functions with different configurations
export const createMockNotifier = (): MockNotifier => {
  return new MockNotifier();
};

export const createReliableNotifier = (): MockNotifier => {
  return new MockNotifier({
    deliveryDelay: 50,
    failureRate: 0,
    maxRetries: 1,
    enableLogging: true,
  });
};

export const createUnreliableNotifier = (): MockNotifier => {
  return new MockNotifier({
    deliveryDelay: 200,
    failureRate: 0.2, // 20% failure rate
    maxRetries: 5,
    enableLogging: true,
  });
};

export const createSlowNotifier = (): MockNotifier => {
  return new MockNotifier({
    deliveryDelay: 1000,
    failureRate: 0.05,
    maxRetries: 3,
    enableLogging: true,
  });
};

// Notification message builders
export const createInfoNotification = (
  title: string, 
  body: string, 
  overrides: Partial<NotificationMessage> = {}
): NotificationMessage => ({
  type: 'info',
  title,
  body,
  timestamp: new Date(),
  ...overrides,
});

export const createSuccessNotification = (
  title: string, 
  body: string, 
  overrides: Partial<NotificationMessage> = {}
): NotificationMessage => ({
  type: 'success',
  title,
  body,
  timestamp: new Date(),
  ...overrides,
});

export const createWarningNotification = (
  title: string, 
  body: string, 
  overrides: Partial<NotificationMessage> = {}
): NotificationMessage => ({
  type: 'warning',
  title,
  body,
  timestamp: new Date(),
  ...overrides,
});

export const createErrorNotification = (
  title: string, 
  body: string, 
  overrides: Partial<NotificationMessage> = {}
): NotificationMessage => ({
  type: 'error',
  title,
  body,
  timestamp: new Date(),
  ...overrides,
});

// Test scenario helpers
export const TEST_SCENARIOS = {
  // Single notification success
  singleSuccess: async (notifier: MockNotifier, message: NotificationMessage) => {
    return await notifier.simulateNotification(message, true);
  },

  // Single notification failure
  singleFailure: async (notifier: MockNotifier, message: NotificationMessage) => {
    return await notifier.simulateNotification(message, false);
  },

  // Multiple notifications
  multipleNotifications: async (notifier: MockNotifier, messages: NotificationMessage[]) => {
    return await notifier.notifyBatch(messages);
  },

  // Notification with subscriber
  notificationWithSubscriber: async (notifier: MockNotifier, message: NotificationMessage) => {
    const receivedMessages: NotificationMessage[] = [];
    
    notifier.subscribe((msg) => {
      receivedMessages.push(msg);
    });

    const result = await notifier.notify(message);
    return { result, receivedMessages };
  },

  // High volume notifications
  highVolumeTest: async (notifier: MockNotifier, count: number) => {
    const messages = Array.from({ length: count }, (_, i) => 
      createInfoNotification(`Test ${i}`, `Test notification number ${i}`)
    );
    
    const startTime = Date.now();
    const results = await notifier.notifyBatch(messages);
    const duration = Date.now() - startTime;
    
    return { results, duration, throughput: count / (duration / 1000) };
  },

  // Mixed notification types
  mixedTypes: async (notifier: MockNotifier) => {
    const messages = [
      createInfoNotification('Info', 'This is an info message'),
      createSuccessNotification('Success', 'Operation completed successfully'),
      createWarningNotification('Warning', 'This is a warning'),
      createErrorNotification('Error', 'An error occurred'),
    ];
    
    return await notifier.notifyBatch(messages);
  },

  // Subscriber stress test
  subscriberStressTest: (notifier: MockNotifier, subscriberCount: number) => {
    const subscribers: Array<(_msg: NotificationMessage) => void> = [];
    
    for (let i = 0; i < subscriberCount; i++) {
      const subscriber = (msg: NotificationMessage) => {
        // Simulate some processing
        const processed = { ...msg, processedBy: i };
        subscribers.push(() => processed);
      };
      notifier.subscribe(subscriber);
    }
    
    return async (message: NotificationMessage) => {
      const startTime = Date.now();
      await notifier.notify(message);
      const duration = Date.now() - startTime;
      
      return { duration, subscriberCount };
    };
  },
};