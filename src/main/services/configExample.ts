// Configuration Manager Service Example
// Demonstrates usage of the configuration management system
// TEMPORARY: This file should be removed once proper Jest testing is in place (Issue #5)

import { DatabaseService } from '../database';

import { ConfigManager } from './configManager';
import { DatabaseConfigRepository } from './configRepository';

// Example usage of the Configuration Manager
const runConfigExample = async (): Promise<void> => {
  console.log('🔧 Configuration Manager Example');
  console.log('=====================================');

  try {
    // Initialize database service
    console.log('📂 Initializing database service...');
    const database = new DatabaseService();
    const dbResult = await database.connect();
    
    if (!dbResult.ok) {
      console.error('❌ Failed to connect to database:', dbResult.error.message);
      return;
    }
    console.log('✅ Database connected successfully');

    // Create configuration repository
    console.log('🗄️ Setting up configuration repository...');
    const configRepo = new DatabaseConfigRepository(database);
    await configRepo.initialize();
    console.log('✅ Configuration repository initialized');

    // Create configuration manager
    console.log('⚙️ Creating configuration manager...');
    const configManager = new ConfigManager(configRepo);
    
    const initResult = await configManager.initialize();
    if (!initResult.ok) {
      console.error('❌ Failed to initialize config manager:', initResult.error.message);
      return;
    }
    console.log('✅ Configuration manager initialized');

    // Demonstrate getting configuration
    console.log('\n📋 Getting current configuration...');
    const configResult = configManager.getConfig();
    if (configResult.ok) {
      console.log('✅ Configuration loaded:');
      console.log(`   Version: ${configResult.value.version}`);
      console.log(`   Watch directories: ${configResult.value.watchDirectories.length} configured`);
      console.log(`   Notifications enabled: ${configResult.value.notifications.enabled}`);
      console.log(`   Theme: ${configResult.value.ui.theme}`);
    }

    // Demonstrate configuration updates
    console.log('\n🔄 Testing configuration updates...');
    
    // Update notification settings
    console.log('📢 Updating notification settings...');
    const notificationUpdate = await configManager.updateNotifications({
      warningIntervals: [120, 60, 30, 15, 5], // Extended warning intervals
      sound: false // Disable sound
    });
    
    if (notificationUpdate.ok) {
      console.log('✅ Notifications updated:');
      console.log(`   Warning intervals: [${notificationUpdate.value.notifications.warningIntervals.join(', ')}] minutes`);
      console.log(`   Sound enabled: ${notificationUpdate.value.notifications.sound}`);
    }

    // Update UI settings
    console.log('🎨 Updating UI settings...');
    const uiUpdate = await configManager.updateUI({
      theme: 'dark',
      compactMode: true,
      position: 'left'
    });
    
    if (uiUpdate.ok) {
      console.log('✅ UI updated:');
      console.log(`   Theme: ${uiUpdate.value.ui.theme}`);
      console.log(`   Compact mode: ${uiUpdate.value.ui.compactMode}`);
      console.log(`   Position: ${uiUpdate.value.ui.position}`);
    }

    // Demonstrate watch directory management
    console.log('\n📁 Testing watch directory management...');
    
    // Add a new watch directory
    console.log('➕ Adding watch directory...');
    const addDirResult = await configManager.addWatchDirectory('/Users/developer/terraform-projects');
    if (addDirResult.ok) {
      console.log('✅ Watch directory added');
      console.log(`   Total directories: ${addDirResult.value.watchDirectories.length}`);
    }

    // Try to add duplicate (should be handled gracefully)
    console.log('🔄 Testing duplicate directory handling...');
    const duplicateResult = await configManager.addWatchDirectory('/Users/developer/terraform-projects');
    if (duplicateResult.ok) {
      console.log('✅ Duplicate handling worked correctly');
      console.log(`   Total directories: ${duplicateResult.value.watchDirectories.length} (no change)`);
    }

    // Remove a directory
    console.log('➖ Removing watch directory...');
    const removeDirResult = await configManager.removeWatchDirectory('/Users/developer/terraform-projects');
    if (removeDirResult.ok) {
      console.log('✅ Watch directory removed');
      console.log(`   Total directories: ${removeDirResult.value.watchDirectories.length}`);
    }

    // Demonstrate configuration sections
    console.log('\n📊 Testing configuration section access...');
    
    const notificationConfig = configManager.getNotificationConfig();
    if (notificationConfig.ok) {
      console.log('✅ Notification config retrieved:');
      console.log(`   Enabled: ${notificationConfig.value.enabled}`);
      console.log(`   Warning intervals: [${notificationConfig.value.warningIntervals.join(', ')}]`);
    }

    const behaviorConfig = configManager.getBehaviorConfig();
    if (behaviorConfig.ok) {
      console.log('✅ Behavior config retrieved:');
      console.log(`   Auto discovery: ${behaviorConfig.value.autoDiscovery}`);
      console.log(`   Confirm destruction: ${behaviorConfig.value.confirmDestruction}`);
      console.log(`   Max concurrent: ${behaviorConfig.value.maxConcurrentDestructions}`);
    }

    // Demonstrate backup functionality
    console.log('\n💾 Testing configuration backup...');
    const backupResult = await configManager.createBackup();
    if (backupResult.ok) {
      console.log('✅ Configuration backed up to:');
      console.log(`   ${backupResult.value}`);
      
      // Test restore (restore the same backup)
      console.log('🔄 Testing backup restore...');
      const restoreResult = await configManager.restoreFromBackup(backupResult.value);
      if (restoreResult.ok) {
        console.log('✅ Configuration restored successfully');
      }
    }

    // Demonstrate event handling
    console.log('\n🎧 Testing configuration change events...');
    
    let changeCount = 0;
    const unsubscribe = configManager.onChange((config) => {
      changeCount++;
      console.log(`✅ Configuration change event #${changeCount} received`);
      console.log(`   Updated at: ${config.updatedAt.toISOString()}`);
    });

    // Make a change to trigger event
    await configManager.updateBehavior({ 
      maxConcurrentDestructions: 5 
    });
    
    // Unsubscribe from events
    unsubscribe();
    console.log('✅ Event handler unsubscribed');

    // Test reset functionality
    console.log('\n🔄 Testing configuration reset...');
    const resetResult = await configManager.resetToDefaults();
    if (resetResult.ok) {
      console.log('✅ Configuration reset to defaults');
      console.log(`   Version: ${resetResult.value.version}`);
      console.log(`   Theme: ${resetResult.value.ui.theme}`);
      console.log(`   Max concurrent: ${resetResult.value.behavior.maxConcurrentDestructions}`);
    }

    // Demonstrate validation
    console.log('\n✅ Testing configuration validation...');
    
    // Test invalid configuration
    const invalidUpdate = await configManager.updateBehavior({
      maxConcurrentDestructions: 15 // Should exceed maximum allowed
    });
    
    if (!invalidUpdate.ok) {
      console.log('✅ Validation working correctly - rejected invalid config:');
      console.log(`   Error: ${invalidUpdate.error.message}`);
    }

    console.log('\n🎉 Configuration Manager example completed successfully!');
    console.log('=====================================');

    // Clean up
    await database.disconnect();
    console.log('🔌 Database disconnected');

  } catch (error) {
    console.error('❌ Configuration example failed:', error);
  }
};

// Export for potential use in tests
export { runConfigExample };

// Run example if this file is executed directly
if (require.main === module) {
  runConfigExample().catch(console.error);
}