/**
 * NotifierService - Manages system notifications via Electron
 * 
 * Follows functional programming principles with:
 * - Result<T, E> pattern for error handling
 * - Pure functions where possible
 * - Event-driven architecture
 * - No global state
 */

import { EventEmitter } from 'events';

import { Notification } from 'electron';

import { 
  NotifierService as INotifierService, 
  NotificationMessage, 
  NotificationType,
  NotificationConfig,
  Result
} from '../../shared/types';
import { Ok, Err } from '../../shared/utils/result';

interface NotificationStats {
  totalNotifications: number;
  byType: Record<NotificationType, number>;
  failedNotifications: number;
}

/**
 * Notifier service that manages desktop notifications
 * Uses pure functional patterns with explicit dependency injection
 */
export class NotifierService extends EventEmitter implements INotifierService {
  private subscribers: Array<(message: NotificationMessage) => void> = [];
  private stats: NotificationStats = {
    totalNotifications: 0,
    byType: {
      info: 0,
      success: 0,
      warning: 0,
      error: 0
    },
    failedNotifications: 0
  };

  constructor(
    private readonly config: NotificationConfig = {
      enabled: true,
      desktop: true,
      sound: true
    }
  ) {
    super();
  }

  /**
   * Send a notification
   */
  async notify(message: NotificationMessage): Promise<Result<void>> {
    try {
      // Check if notifications are enabled
      if (!this.config.enabled) {
        return Ok(undefined);
      }

      // Update statistics
      this.stats.totalNotifications++;
      this.stats.byType[message.type]++;

      // Notify all subscribers
      this.notifySubscribers(message);

      // Send desktop notification if enabled
      if (this.config.desktop) {
        const notifyResult = await this.sendDesktopNotification(message);
        if (!notifyResult.ok) {
          this.stats.failedNotifications++;
          return notifyResult;
        }
      }

      // Emit event for internal listeners
      this.emit('notification_sent', {
        type: message.type,
        title: message.title,
        projectId: message.projectId,
        executionId: message.executionId,
        timestamp: message.timestamp
      });

      return Ok(undefined);
    } catch (error) {
      this.stats.failedNotifications++;
      return Err(error as Error);
    }
  }

  /**
   * Subscribe to notifications
   */
  subscribe(callback: (message: NotificationMessage) => void): void {
    this.subscribers.push(callback);
  }

  /**
   * Unsubscribe from notifications
   */
  unsubscribe(callback: (message: NotificationMessage) => void): void {
    const index = this.subscribers.indexOf(callback);
    if (index !== -1) {
      this.subscribers.splice(index, 1);
    }
  }

  /**
   * Send desktop notification via Electron
   */
  private async sendDesktopNotification(message: NotificationMessage): Promise<Result<void>> {
    return new Promise((resolve) => {
      try {
        const notification = new Notification({
          title: message.title,
          body: message.body,
          icon: this.getNotificationIcon(message.type),
          sound: this.config.sound ? this.getNotificationSound(message.type) : undefined,
          urgency: this.getNotificationUrgency(message.type),
          timeoutType: this.getNotificationTimeout(message.type)
        });

        // Handle notification events
        notification.on('show', () => {
          this.emit('notification_shown', {
            type: message.type,
            title: message.title,
            projectId: message.projectId
          });
        });

        notification.on('click', () => {
          this.emit('notification_clicked', {
            type: message.type,
            title: message.title,
            projectId: message.projectId,
            executionId: message.executionId
          });
        });

        notification.on('close', () => {
          this.emit('notification_closed', {
            type: message.type,
            title: message.title,
            projectId: message.projectId
          });
        });

        notification.on('reply', (event, reply) => {
          this.emit('notification_reply', {
            type: message.type,
            title: message.title,
            projectId: message.projectId,
            reply
          });
        });

        notification.on('action', (event, index) => {
          this.emit('notification_action', {
            type: message.type,
            title: message.title,
            projectId: message.projectId,
            actionIndex: index
          });
        });

        // Show the notification
        notification.show();
        resolve(Ok(undefined));
      } catch (error) {
        resolve(Err(error as Error));
      }
    });
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(message: NotificationMessage): void {
    for (const callback of this.subscribers) {
      try {
        callback(message);
      } catch (error) {
        // Log error but don't fail the notification
        this.emit('subscriber_error', {
          error: error as Error,
          message
        });
      }
    }
  }

  /**
   * Get notification icon based on type
   */
  private getNotificationIcon(type: NotificationType): string | undefined {
    const iconMap: Record<NotificationType, string> = {
      info: '🔵',
      success: '✅',
      warning: '⚠️',
      error: '❌'
    };
    return iconMap[type];
  }

  /**
   * Get notification sound based on type
   */
  private getNotificationSound(type: NotificationType): string | undefined {
    // Use system default sounds for different types
    const soundMap: Record<NotificationType, string | undefined> = {
      info: undefined, // Default system sound
      success: undefined, // Default system sound
      warning: 'Glass', // Warning sound on macOS
      error: 'Sosumi' // Error sound on macOS
    };
    return soundMap[type];
  }

  /**
   * Get notification urgency based on type
   */
  private getNotificationUrgency(type: NotificationType): 'normal' | 'critical' | 'low' {
    const urgencyMap: Record<NotificationType, 'normal' | 'critical' | 'low'> = {
      info: 'low',
      success: 'normal',
      warning: 'normal',
      error: 'critical'
    };
    return urgencyMap[type];
  }

  /**
   * Get notification timeout based on type
   */
  private getNotificationTimeout(type: NotificationType): 'default' | 'never' {
    // Keep error and warning notifications visible longer
    return (type === 'error' || type === 'warning') ? 'never' : 'default';
  }

  /**
   * Create convenience methods for different notification types
   */
  async info(title: string, body: string, projectId?: string): Promise<Result<void>> {
    return this.notify({
      type: 'info',
      title,
      body,
      projectId,
      timestamp: new Date()
    });
  }

  async success(title: string, body: string, projectId?: string): Promise<Result<void>> {
    return this.notify({
      type: 'success',
      title,
      body,
      projectId,
      timestamp: new Date()
    });
  }

  async warning(title: string, body: string, projectId?: string): Promise<Result<void>> {
    return this.notify({
      type: 'warning',
      title,
      body,
      projectId,
      timestamp: new Date()
    });
  }

  async error(title: string, body: string, projectId?: string): Promise<Result<void>> {
    return this.notify({
      type: 'error',
      title,
      body,
      projectId,
      timestamp: new Date()
    });
  }

  /**
   * Specialized notification methods for application events
   */
  async notifyProjectDiscovered(projectName: string, projectId: string): Promise<Result<void>> {
    return this.info(
      'Project Discovered',
      `Found new project: ${projectName}`,
      projectId
    );
  }

  async notifyDestructionScheduled(
    projectName: string, 
    projectId: string, 
    destroyAt: Date
  ): Promise<Result<void>> {
    const timeString = destroyAt.toLocaleString();
    return this.info(
      'Destruction Scheduled',
      `${projectName} will be destroyed at ${timeString}`,
      projectId
    );
  }

  async notifyDestructionWarning(
    projectName: string, 
    projectId: string, 
    minutesRemaining: number
  ): Promise<Result<void>> {
    const timeText = minutesRemaining === 1 ? '1 minute' : `${minutesRemaining} minutes`;
    return this.warning(
      'Destruction Warning',
      `${projectName} will be destroyed in ${timeText}`,
      projectId
    );
  }

  async notifyDestructionStarted(projectName: string, projectId: string): Promise<Result<void>> {
    return this.warning(
      'Destruction Started',
      `Starting destruction of ${projectName}`,
      projectId
    );
  }

  async notifyDestructionCompleted(
    projectName: string, 
    projectId: string,
    duration: number
  ): Promise<Result<void>> {
    const durationText = `${Math.round(duration / 1000)}s`;
    return this.success(
      'Destruction Completed',
      `${projectName} was successfully destroyed (${durationText})`,
      projectId
    );
  }

  async notifyDestructionFailed(
    projectName: string, 
    projectId: string,
    error: string
  ): Promise<Result<void>> {
    return this.error(
      'Destruction Failed',
      `Failed to destroy ${projectName}: ${error}`,
      projectId
    );
  }

  async notifyExecutionCancelled(projectName: string, projectId: string): Promise<Result<void>> {
    return this.info(
      'Execution Cancelled',
      `Destruction of ${projectName} was cancelled`,
      projectId
    );
  }

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    return {
      totalNotifications: this.stats.totalNotifications,
      byType: { ...this.stats.byType },
      failedNotifications: this.stats.failedNotifications
    };
  }

  /**
   * Get notifier configuration
   */
  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<NotificationConfig>): void {
    Object.assign(this.config, newConfig);
    this.emit('config_updated', { config: this.getConfig() });
  }

  /**
   * Get subscriber count
   */
  getSubscriberCount(): number {
    return this.subscribers.length;
  }

  /**
   * Clear all subscribers
   */
  clearSubscribers(): void {
    this.subscribers = [];
    this.emit('subscribers_cleared');
  }
}