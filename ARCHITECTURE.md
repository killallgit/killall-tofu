# Killall-Tofu Architecture

## System Overview

Killall-Tofu is built as an Electron application with a clear separation between the main process (backend services) and renderer process (UI). The architecture follows functional programming principles with immutable state management and pure functions wherever possible.

## Core Design Principles

1. **No Global State** - All state is explicitly managed and passed
2. **Functional Paradigm** - Pure functions, immutability, composition
3. **Event-Driven** - Services communicate through events
4. **Dependency Injection** - Services receive dependencies explicitly
5. **Result Types** - Explicit error handling without exceptions

## System Architecture Diagram

```mermaid
graph TB
    subgraph "User Interface"
        MenuBar[Menu Bar Icon]
        Dropdown[React Dropdown Menu]
        Notifications[System Notifications]
    end
    
    subgraph "Main Process"
        App[Electron App]
        TrayManager[Tray Manager]
        
        subgraph "Core Services"
            FileWatcher[File Watcher]
            Scheduler[Scheduler]
            Executor[Executor]
            Notifier[Notifier]
        end
        
        subgraph "Support Services"
            ConfigManager[Config Manager]
            Database[Database Service]
            Logger[Logger]
        end
    end
    
    subgraph "File System"
        ConfigFiles[~/.killall/]
        WatchDirs[Watch Directories]
        KillallYaml[.killall.yaml files]
    end
    
    subgraph "External"
        Terraform[Terraform Process]
    end
    
    MenuBar <--> TrayManager
    TrayManager <--> Dropdown
    TrayManager --> Notifier
    Notifier --> Notifications
    
    App --> TrayManager
    App --> FileWatcher
    App --> Scheduler
    
    FileWatcher --> WatchDirs
    WatchDirs --> KillallYaml
    FileWatcher --> Database
    FileWatcher --> Scheduler
    
    Scheduler --> Executor
    Scheduler --> Database
    Scheduler --> Notifier
    
    Executor --> Terraform
    Executor --> Database
    Executor --> Logger
    
    ConfigManager --> ConfigFiles
    Database --> ConfigFiles
    Logger --> ConfigFiles
```

## Component Architecture

### Main Process Components

#### Application Core (`src/main/app.ts`)
```typescript
interface AppCore {
  initialize(): Promise<Result<void>>;
  start(): Promise<Result<void>>;
  shutdown(): Promise<Result<void>>;
}
```
- Bootstraps the application
- Initializes all services
- Manages application lifecycle
- Handles system events

#### Tray Manager (`src/main/tray.ts`)
```typescript
interface TrayManager {
  create(): Result<void>;
  updateIcon(state: IconState): void;
  updateBadge(count: number): void;
  showMenu(): void;
  destroy(): void;
}
```
- Manages menu bar icon
- Handles icon animations (pulsing, spinning)
- Updates badge count
- Creates context menu

### Core Services

#### File Watcher Service (`src/main/services/watcher.ts`)
```typescript
interface FileWatcher {
  start(config: WatcherConfig): Promise<Result<void>>;
  stop(): Promise<void>;
  scan(): Promise<Result<ProjectConfig[]>>;
  onProjectDiscovered(handler: ProjectHandler): void;
  onProjectRemoved(handler: ProjectHandler): void;
}
```

**Responsibilities:**
- Recursively scans configured directories
- Detects `.killall.yaml` files
- Parses and validates configurations
- Emits events for project discovery/removal
- Respects ignore patterns

**Data Flow:**
```
Watch Dirs → Scan → Find .killall.yaml → Parse → Validate → Emit Event
```

#### Scheduler Service (`src/main/services/scheduler.ts`)
```typescript
interface Scheduler {
  register(project: Project): Result<void>;
  cancel(projectId: string): Result<void>;
  extend(projectId: string, duration: string): Result<void>;
  getActive(): Project[];
  onDestroy(handler: DestroyHandler): void;
  onWarning(handler: WarningHandler): void;
}
```

**Responsibilities:**
- Maintains timer registry
- Calculates destruction times
- Emits warning events
- Triggers destruction events
- Handles timer extensions/cancellations

**State Management:**
```typescript
type SchedulerState = {
  readonly timers: Map<string, Timer>;
  readonly warnings: Map<string, Set<number>>;
};
```

#### Executor Service (`src/main/services/executor.ts`)
```typescript
interface Executor {
  execute(project: Project): Promise<Result<ExecutionResult>>;
  cancel(executionId: string): Result<void>;
  getRunning(): Execution[];
  onComplete(handler: ExecutionHandler): void;
  onFailed(handler: ExecutionHandler): void;
}
```

**Responsibilities:**
- Spawns terraform processes
- Captures stdout/stderr
- Implements retry logic
- Manages concurrent executions
- Handles timeouts

**Execution Pipeline:**
```
Pre-hooks → Main Command → Post-hooks → Cleanup
     ↓            ↓             ↓          ↓
   Retry       Retry         Retry    Log Results
```

#### Notifier Service (`src/main/services/notifier.ts`)
```typescript
interface Notifier {
  notify(notification: Notification): Result<void>;
  scheduleWarning(project: Project, time: number): void;
  cancelWarnings(projectId: string): void;
  playSound(sound: SoundType): void;
}
```

**Responsibilities:**
- System notifications
- Warning scheduling
- Sound alerts
- Notification queuing

### Support Services

#### Config Manager (`src/main/config/manager.ts`)
```typescript
interface ConfigManager {
  load(): Promise<Result<Config>>;
  save(config: Config): Promise<Result<void>>;
  validate(config: unknown): Result<Config>;
  getWatchDirs(): string[];
  getIgnorePatterns(): string[];
}
```

**Configuration Hierarchy:**
1. Default configuration (built-in)
2. Global configuration (`~/.killall/killall.yaml`)
3. Project configuration (`.killall.yaml`)

#### Database Service (`src/main/database/index.ts`)
```typescript
interface Database {
  connect(): Promise<Result<void>>;
  disconnect(): Promise<Result<void>>;
  transaction<T>(fn: TransactionFn<T>): Promise<Result<T>>;
  
  projects: ProjectRepository;
  executions: ExecutionRepository;
  events: EventRepository;
}
```

**Schema Management:**
- Automatic migrations on startup
- Schema versioning
- Backup before migrations
- Rollback on failure

#### Logger Service (`src/main/utils/logger.ts`)
```typescript
interface Logger {
  debug(message: string, meta?: object): void;
  info(message: string, meta?: object): void;
  warn(message: string, meta?: object): void;
  error(message: string, error?: Error, meta?: object): void;
}
```

**Log Rotation:**
- Size-based rotation (10MB default)
- Compression of archived logs
- Automatic cleanup of old logs

### Renderer Process Components

#### React Application (`src/renderer/App.tsx`)
```typescript
const App: FC = () => {
  const projects = useProjects();
  const recent = useRecentActivity();
  
  return (
    <MenuContainer>
      <ActiveProjects projects={projects} />
      <RecentActivity items={recent} />
      <Settings />
    </MenuContainer>
  );
};
```

#### Component Hierarchy
```
App
├── MenuContainer
│   ├── Header
│   ├── ActiveProjects
│   │   └── ProjectItem
│   │       ├── Countdown
│   │       ├── Actions
│   │       └── Tags
│   ├── RecentActivity
│   │   └── ActivityItem
│   └── Settings
│       ├── WatchDirectories
│       ├── IgnorePatterns
│       └── Notifications
└── StatusBar
```

## Data Flow

### Project Discovery Flow
```mermaid
sequenceDiagram
    participant FW as FileWatcher
    participant DB as Database
    participant SC as Scheduler
    participant NT as Notifier
    
    FW->>FW: Scan directories
    FW->>FW: Find .killall.yaml
    FW->>FW: Parse & validate
    FW->>DB: Check if exists
    DB-->>FW: Not found
    FW->>DB: Create project
    FW->>SC: Register timer
    SC->>NT: Schedule warnings
    NT->>NT: Queue notification
```

### Destruction Flow
```mermaid
sequenceDiagram
    participant SC as Scheduler
    participant EX as Executor
    participant DB as Database
    participant NT as Notifier
    participant TF as Terraform
    
    SC->>SC: Timer expires
    SC->>DB: Update status
    SC->>EX: Execute destruction
    EX->>TF: Run command
    TF-->>EX: Output
    EX->>DB: Log execution
    alt Success
        EX->>DB: Mark destroyed
        EX->>NT: Success notification
    else Failure
        EX->>EX: Retry logic
        EX->>DB: Log failure
        EX->>NT: Failure notification
    end
```

## State Management

### Application State
```typescript
type AppState = {
  readonly config: Config;
  readonly projects: Map<string, Project>;
  readonly executions: Map<string, Execution>;
  readonly ui: UIState;
};

type UIState = {
  readonly menuOpen: boolean;
  readonly activeTab: Tab;
  readonly notifications: Notification[];
};
```

### State Updates (Immutable)
```typescript
const updateProject = (
  state: AppState,
  projectId: string,
  updates: Partial<Project>
): AppState => ({
  ...state,
  projects: new Map([
    ...state.projects,
    [projectId, {
      ...state.projects.get(projectId),
      ...updates,
      updatedAt: new Date()
    }]
  ])
});
```

## Communication Patterns

### Inter-Process Communication (IPC)
```typescript
// Main → Renderer
ipcMain.handle('get-projects', async () => {
  return scheduler.getActive();
});

// Renderer → Main
const projects = await ipcRenderer.invoke('get-projects');
```

### Event System
```typescript
// Event emitter pattern with typed events
interface EventMap {
  'project:discovered': ProjectEvent;
  'project:destroyed': ProjectEvent;
  'execution:complete': ExecutionEvent;
  'warning:triggered': WarningEvent;
}

class TypedEventEmitter<T extends Record<string, any>> {
  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): void;
  emit<K extends keyof T>(event: K, data: T[K]): void;
}
```

## Error Handling

### Result Type Pattern
```typescript
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// Usage
const parseConfig = (content: string): Result<Config> => {
  try {
    const config = yaml.parse(content);
    return { ok: true, value: config };
  } catch (error) {
    return { ok: false, error };
  }
};

// Handling
const result = parseConfig(content);
if (result.ok) {
  // Use result.value
} else {
  // Handle result.error
}
```

### Error Recovery
```typescript
const withRetry = async <T>(
  fn: () => Promise<Result<T>>,
  options: RetryOptions
): Promise<Result<T>> => {
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    const result = await fn();
    if (result.ok) return result;
    
    if (attempt < options.maxAttempts) {
      await sleep(options.delay * Math.pow(2, attempt - 1));
    }
  }
  return { ok: false, error: new Error('Max retries exceeded') };
};
```

## Performance Considerations

### Optimization Strategies

1. **File Watching**
   - Use ignore patterns to reduce scan scope
   - Implement incremental scanning
   - Cache parsed configurations
   - Debounce rapid changes

2. **Database**
   - Use prepared statements
   - Batch inserts/updates
   - Index frequently queried columns
   - Vacuum periodically

3. **UI Rendering**
   - Virtual scrolling for long lists
   - Memoize expensive computations
   - Lazy load components
   - Debounce search inputs

4. **Memory Management**
   - Clear timers on cancellation
   - Dispose event listeners
   - Limit log retention
   - Stream large outputs

### Performance Metrics
```typescript
interface PerformanceMetrics {
  scanDuration: number;      // Time to scan all directories
  projectCount: number;      // Number of active projects
  memoryUsage: number;      // Current memory usage
  cpuUsage: number;         // CPU percentage
  dbSize: number;           // Database file size
}
```

## Security Architecture

### Input Validation
```typescript
const validatePath = (path: string): Result<string> => {
  // Prevent path traversal
  if (path.includes('..')) {
    return { ok: false, error: new Error('Invalid path') };
  }
  
  // Validate absolute path
  if (!path.startsWith('/')) {
    return { ok: false, error: new Error('Must be absolute path') };
  }
  
  return { ok: true, value: path };
};
```

### Process Isolation
```typescript
const executeCommand = async (
  command: string,
  options: ExecutionOptions
): Promise<Result<ExecutionResult>> => {
  const child = spawn(command, {
    shell: false,           // No shell expansion
    env: filterEnv(process.env),  // Filtered environment
    timeout: options.timeout,
    cwd: options.workingDir,
    uid: process.getuid(),  // Run as current user
    gid: process.getgid()
  });
  
  // Handle output...
};
```

## Testing Architecture

### Test Structure
```
src/
├── main/
│   ├── services/
│   │   ├── __tests__/
│   │   │   ├── watcher.test.ts
│   │   │   ├── scheduler.test.ts
│   │   │   └── executor.test.ts
│   │   └── __mocks__/
│   │       └── database.ts
└── renderer/
    ├── components/
    │   └── __tests__/
    │       └── ProjectItem.test.tsx
    └── __mocks__/
        └── electron.ts
```

### Test Patterns
```typescript
// Unit test with mocked dependencies
describe('Scheduler', () => {
  let scheduler: Scheduler;
  let mockDatabase: jest.Mocked<Database>;
  let mockNotifier: jest.Mocked<Notifier>;
  
  beforeEach(() => {
    mockDatabase = createMockDatabase();
    mockNotifier = createMockNotifier();
    scheduler = new Scheduler(mockDatabase, mockNotifier);
  });
  
  it('should register project with correct destroy time', () => {
    const project = createTestProject({ timeout: '2 hours' });
    const result = scheduler.register(project);
    
    expect(result.ok).toBe(true);
    expect(mockDatabase.projects.create).toHaveBeenCalled();
  });
});
```

## Deployment Architecture

### Build Pipeline
```
Source → TypeScript → Webpack → Electron Builder → DMG/ZIP
                ↓         ↓            ↓
             Tests    Optimize    Code Sign
```

### Auto-Update Flow
```typescript
interface UpdateManager {
  checkForUpdates(): Promise<Result<UpdateInfo>>;
  downloadUpdate(): Promise<Result<void>>;
  installUpdate(): void;
  onUpdateAvailable(handler: UpdateHandler): void;
}
```

## Monitoring & Observability

### Health Checks
```typescript
interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    database: boolean;
    fileWatcher: boolean;
    scheduler: boolean;
    diskSpace: boolean;
  };
  metrics: PerformanceMetrics;
}
```

### Telemetry (Optional)
```typescript
interface TelemetryData {
  version: string;
  platform: string;
  projectCount: number;
  executionCount: number;
  errorRate: number;
  averageDestroyTime: number;
}
```

## Future Architecture Considerations

### Plugin System (v2)
```typescript
interface Plugin {
  name: string;
  version: string;
  hooks: {
    beforeDestroy?: (project: Project) => Promise<Result<void>>;
    afterDestroy?: (project: Project, result: ExecutionResult) => Promise<Result<void>>;
    onError?: (error: Error, project: Project) => Promise<Result<void>>;
  };
}
```

### Multi-Platform Support
- Abstract platform-specific code
- Create platform adapters
- Unified notification API
- Cross-platform file paths

### Distributed Architecture
- Central configuration server
- Team synchronization
- Remote execution agents
- Audit logging service