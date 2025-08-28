# FileWatcher Service Examples

This document provides practical examples of how to use the FileWatcher service for project discovery and configuration monitoring.

## Basic Usage

### Starting the File Watcher

```typescript
import { Database } from './database';
import { FileWatcherService } from './services';

// Initialize database and file watcher
const database = new Database();
await database.connect();

const fileWatcher = new FileWatcherService(database);

// Start watching for .killall.yaml files
const result = await fileWatcher.start({
  watchPaths: [
    '/Users/developer/projects',
    '/Users/developer/infrastructure'
  ],
  debounceDelay: 1000, // Wait 1 second before processing changes
  maxDepth: 10, // Scan up to 10 directory levels deep
});

if (result.ok) {
  console.log('File watcher started successfully');
  console.log(`Watching ${result.value.watchedPaths.length} paths`);
} else {
  console.error('Failed to start file watcher:', result.error.message);
}
```

### Listening for Project Events

```typescript
// Listen for newly discovered projects
fileWatcher.on('projectDiscovered', (event) => {
  console.log(`New project discovered: ${event.project?.name}`);
  console.log(`Location: ${event.project?.path}`);
  console.log(`Destroy time: ${event.project?.destroyAt}`);
});

// Listen for project configuration updates
fileWatcher.on('projectUpdated', (event) => {
  console.log(`Project updated: ${event.project?.name}`);
  
  const config = JSON.parse(event.project?.config || '{}');
  console.log(`New timeout: ${config.timeout}`);
});

// Listen for removed projects
fileWatcher.on('projectRemoved', (event) => {
  console.log(`Project removed: ${event.project?.name}`);
  console.log(`Reason: Configuration file deleted`);
});

// Handle errors gracefully
fileWatcher.on('error', (event) => {
  console.error('File watcher error:', event.error?.message);
  console.error('Path:', event.path);
});
```

## Configuration File Examples

### Basic Configuration

```yaml
# .killall.yaml
version: 1
timeout: "2 hours"
name: "Development Environment"
command: "terraform destroy -auto-approve"
```

### Complete Configuration

```yaml
# .killall.yaml
version: 1
timeout: "4 hours"
name: "Production Infrastructure"
command: "terraform destroy -auto-approve"
tags:
  - "production"
  - "aws"
  - "critical"

execution:
  working_directory: "./terraform"
  environment_variables:
    TF_VAR_environment: "prod"
    AWS_DEFAULT_REGION: "us-west-2"
    TF_LOG: "INFO"

hooks:
  before_destroy:
    - "terraform plan -destroy -out=destroy.plan"
    - "echo 'Starting infrastructure destruction...'"
  after_destroy:
    - "rm -f destroy.plan"
    - "echo 'Infrastructure destroyed successfully'"
    - "slack-notify 'Production environment destroyed'"
```

### Development Configuration

```yaml
# .killall.yaml
version: 1
timeout: "30 minutes"
name: "Quick Development Test"
command: "docker-compose down -v"
tags:
  - "development"
  - "docker"

execution:
  working_directory: "."
  environment_variables:
    COMPOSE_PROJECT_NAME: "dev-test"

hooks:
  before_destroy:
    - "docker-compose ps"
  after_destroy:
    - "docker system prune -f"
```

## Advanced Usage Patterns

### Dynamic Path Management

```typescript
// Add new directories to watch at runtime
const newProjectPath = '/Users/developer/new-project';
const addResult = await fileWatcher.addWatchPath(newProjectPath);

if (addResult.ok) {
  console.log(`Now watching: ${newProjectPath}`);
}

// Remove directories from watching
const removeResult = await fileWatcher.removeWatchPath('/old/project/path');

if (removeResult.ok) {
  console.log('Stopped watching old project path');
}
```

### Manual Project Discovery

```typescript
// Trigger manual scan of all watched directories
const scanResult = await fileWatcher.scan();

if (scanResult.ok) {
  const stats = fileWatcher.getStats();
  console.log(`Discovered ${stats.discoveredProjects} projects`);
  console.log(`Last scan: ${stats.lastScanTime}`);
}

// Discover a specific project by path
import { ProjectDiscoveryService } from './services';

const discovery = new ProjectDiscoveryService(database.projects, database.events);
const projectResult = await discovery.discoverProject('/path/to/project');

if (projectResult.ok && projectResult.value) {
  console.log(`Found project: ${projectResult.value.name}`);
}
```

### Custom Configuration Validation

```typescript
import { parseConfigFile, validateConfig } from './services';

// Parse a specific config file
const configResult = await parseConfigFile('/path/to/.killall.yaml');

if (configResult.ok) {
  const config = configResult.value;
  console.log(`Project: ${config.name}`);
  console.log(`Timeout: ${config.timeout}`);
  console.log(`Command: ${config.command}`);
} else {
  console.error('Invalid configuration:', configResult.error.message);
}

// Validate configuration object directly
const customConfig = {
  version: 1,
  timeout: '1 day',
  name: 'Custom Project',
  // ... more config
};

const validationResult = await validateConfig(customConfig, '/project/path');
if (validationResult.ok) {
  console.log('Configuration is valid');
} else {
  console.error('Validation failed:', validationResult.error.message);
}
```

### Error Handling and Recovery

```typescript
// Comprehensive error handling
fileWatcher.on('error', (event) => {
  const error = event.error;
  
  switch (error?.constructor.name) {
    case 'ConfigValidationError':
      console.error(`Config error in ${event.path}: ${error.message}`);
      // Maybe notify user to fix their config file
      break;
      
    case 'Error':
      if (error.message.includes('ENOENT')) {
        console.error(`File not found: ${event.path}`);
        // File was deleted, this is normal
      } else if (error.message.includes('EACCES')) {
        console.error(`Permission denied: ${event.path}`);
        // Need to check file permissions
      } else {
        console.error(`Unknown error: ${error.message}`);
      }
      break;
      
    default:
      console.error('Unexpected error:', error);
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down file watcher...');
  
  const stopResult = await fileWatcher.stop();
  if (stopResult.ok) {
    console.log('File watcher stopped successfully');
  } else {
    console.error('Error stopping file watcher:', stopResult.error.message);
  }
  
  await database.disconnect();
  process.exit(0);
});
```

### Performance Monitoring

```typescript
// Monitor file watcher performance
setInterval(() => {
  const stats = fileWatcher.getStats();
  
  console.log('File Watcher Stats:');
  console.log(`- Watching ${stats.watchedPaths.length} paths`);
  console.log(`- Monitoring ${stats.watchedFiles} files`);
  console.log(`- Discovered ${stats.discoveredProjects} projects`);
  console.log(`- Error count: ${stats.errors}`);
  
  if (stats.lastScanTime) {
    const timeSinceLastScan = Date.now() - stats.lastScanTime.getTime();
    console.log(`- Last scan: ${Math.round(timeSinceLastScan / 1000)}s ago`);
  }
  
  console.log(`- Status: ${stats.isWatching ? 'Active' : 'Stopped'}`);
}, 30000); // Every 30 seconds
```

### Integration with Scheduler Service

```typescript
// Example of how the FileWatcher integrates with other services
import { SchedulerService } from './scheduler'; // Future service

const scheduler = new SchedulerService(database);

fileWatcher.on('projectDiscovered', async (event) => {
  if (event.project) {
    // Schedule the project for destruction
    await scheduler.scheduleDestruction(event.project);
    console.log(`Scheduled ${event.project.name} for destruction at ${event.project.destroyAt}`);
  }
});

fileWatcher.on('projectUpdated', async (event) => {
  if (event.project) {
    // Update the scheduled destruction time
    await scheduler.updateSchedule(event.project);
    console.log(`Updated schedule for ${event.project.name}`);
  }
});

fileWatcher.on('projectRemoved', async (event) => {
  if (event.project) {
    // Cancel the scheduled destruction
    await scheduler.cancelSchedule(event.project.id);
    console.log(`Cancelled schedule for ${event.project.name}`);
  }
});
```

## Duration Format Examples

The FileWatcher service supports natural language duration formats:

```yaml
# All of these are valid timeout formats:
timeout: "30 seconds"
timeout: "5 minutes"
timeout: "2 hours"
timeout: "1 day"
timeout: "7 days"

# Abbreviated forms also work:
timeout: "30s"
timeout: "5m"
timeout: "2h"
timeout: "1d"

# Case insensitive:
timeout: "2 HOURS"
timeout: "1 Day"
```

Valid ranges:
- Minimum: 1 second
- Maximum: 30 days

## Common Patterns and Best Practices

### 1. Organized Project Structure

```
projects/
├── infrastructure/
│   ├── aws-prod/
│   │   └── .killall.yaml      # timeout: "4 hours"
│   ├── aws-staging/
│   │   └── .killall.yaml      # timeout: "2 hours"
│   └── azure-dev/
│       └── .killall.yaml      # timeout: "1 hour"
├── applications/
│   ├── api-service/
│   │   └── .killall.yaml      # timeout: "30 minutes"
│   └── web-frontend/
│       └── .killall.yaml      # timeout: "30 minutes"
└── experiments/
    ├── ml-training/
    │   └── .killall.yaml      # timeout: "6 hours"
    └── performance-test/
        └── .killall.yaml      # timeout: "1 hour"
```

### 2. Environment-Specific Configurations

Use tags and environment variables to differentiate between environments:

```yaml
# Production (longer timeout, more careful hooks)
version: 1
timeout: "4 hours"
tags: ["production", "critical"]
hooks:
  before_destroy:
    - "terraform plan -destroy"
    - "slack-notify 'Production destroy starting in 1 hour'"
    - "sleep 3600"  # Wait 1 hour for review

# Development (shorter timeout, simpler cleanup)
version: 1
timeout: "30 minutes"
tags: ["development", "auto-cleanup"]
hooks:
  after_destroy:
    - "echo 'Dev environment cleaned up'"
```

### 3. Resource-Specific Commands

```yaml
# Docker-based projects
version: 1
timeout: "1 hour"
command: "docker-compose down -v && docker system prune -f"

# Terraform projects  
version: 1
timeout: "2 hours"
command: "terraform destroy -auto-approve"

# Kubernetes projects
version: 1
timeout: "30 minutes"
command: "kubectl delete namespace temp-testing"

# AWS CLI projects
version: 1
timeout: "1 hour"
command: "aws cloudformation delete-stack --stack-name temp-stack"
```

This comprehensive example set should help developers understand and implement the FileWatcher service effectively in their projects.