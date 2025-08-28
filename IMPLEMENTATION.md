# Killall-Tofu Implementation Roadmap

## Overview

This document outlines the parallel development streams for implementing Phase 2 of Killall-Tofu's core functionality. The architecture allows for 5 developers to work simultaneously with minimal dependencies while maintaining code quality and comprehensive testing.

## Development Philosophy

Based on our functional programming standards in `CLAUDE.md`:
- **No Global Variables** - All state explicitly managed and passed
- **Pure Functions** - Immutable operations with predictable outputs
- **Result Types** - Explicit error handling without exceptions
- **Dependency Injection** - Services receive dependencies explicitly
- **Test-Driven Development** - 85%+ coverage requirement

## Current Status

**Phase 1 Complete**: Foundation with Electron + TypeScript + React + comprehensive documentation
**Phase 2 Target**: Fully functional infrastructure management system

## Parallel Development Streams

### Stream 1: Foundation & Testing Infrastructure
**Lead Developer**: Platform/Infrastructure Developer
**Timeline**: Week 1-2 (Blocks other streams)
**Dependencies**: None

#### Tasks
1. **Testing Framework Setup**
   ```bash
   npm install --save-dev jest @types/jest ts-jest
   npm install --save-dev @testing-library/react @testing-library/jest-dom
   ```
   - Configure Jest with TypeScript support
   - Set up React Testing Library
   - Create test utilities and helpers
   - Configure coverage reporting

2. **Shared Type System** (`src/shared/types.ts`)
   ```typescript
   // Result type for error handling
   export type Result<T, E = Error> = 
     | { ok: true; value: T }
     | { ok: false; error: E };

   // Core entity types
   export interface Project {
     id: string;
     path: string;
     config: ProjectConfig;
     // ... other properties
   }
   ```

3. **Functional Utilities** (`src/shared/utils/`)
   - Result type helpers (`result.ts`)
   - Functional composition utilities (`functional.ts`)
   - Duration parsing (`duration.ts`)
   - Path validation (`paths.ts`)

4. **Mock Service Implementations**
   - Create interfaces for all services
   - Implement mock versions for testing
   - Set up test fixtures and sample data

#### Deliverables
- [ ] Complete Jest testing framework
- [ ] Shared TypeScript definitions
- [ ] Functional utility library
- [ ] Mock implementations for all services
- [ ] Test fixtures and sample `.killall.yaml` files

---

### Stream 2: Data Layer
**Lead Developer**: Backend/Database Developer  
**Timeline**: Week 1-3
**Dependencies**: Stream 1 (types and testing)

#### Tasks
1. **Database Service** (`src/main/database/`)
   ```typescript
   interface Database {
     connect(): Promise<Result<void>>;
     transaction<T>(fn: TransactionFn<T>): Promise<Result<T>>;
     projects: ProjectRepository;
     executions: ExecutionRepository;
     events: EventRepository;
   }
   ```
   - SQLite integration with proper connection management
   - Database schema creation and migration system
   - Transaction support for data consistency
   - Connection pooling and error recovery

2. **Configuration Manager** (`src/main/config/`)
   ```typescript
   interface ConfigManager {
     load(): Promise<Result<Config>>;
     save(config: Config): Promise<Result<void>>;
     validate(config: unknown): Result<Config>;
   }
   ```
   - YAML parsing with `js-yaml`
   - Configuration validation and schema checking
   - File system utilities with proper error handling
   - Configuration merging (global + project)

3. **Data Repositories**
   - Project repository with CRUD operations
   - Execution repository for command history
   - Event repository for audit logging
   - Query builders with type safety

#### Testing Requirements
- Unit tests for all repository methods
- Integration tests with in-memory SQLite
- Configuration parsing validation tests
- Error handling and recovery scenarios

#### Deliverables
- [ ] Production-ready SQLite database service
- [ ] Configuration management system with YAML support
- [ ] Data repositories with full CRUD operations
- [ ] 90%+ test coverage on all data layer components

---

### Stream 3: Core Services
**Lead Developer**: Systems/Backend Developer
**Timeline**: Week 2-4 (starts after Stream 1)
**Dependencies**: Stream 1 (types/testing), Stream 2 (database)

#### Tasks
1. **File Watcher Service** (`src/main/services/watcher.ts`)
   ```typescript
   interface FileWatcher {
     start(config: WatcherConfig): Promise<Result<void>>;
     scan(): Promise<Result<ProjectConfig[]>>;
     onProjectDiscovered(handler: ProjectHandler): void;
   }
   ```
   - Chokidar integration for file system monitoring
   - Recursive directory scanning with ignore patterns
   - `.killall.yaml` file detection and parsing
   - Event emission for project discovery/removal
   - Performance optimization for large directory trees

2. **Scheduler Service** (`src/main/services/scheduler.ts`)
   ```typescript
   interface Scheduler {
     register(project: Project): Result<void>;
     extend(projectId: string, duration: string): Result<void>;
     getTimeRemaining(projectId: string): number;
   }
   ```
   - Timer registry with immutable state management
   - Natural language duration parsing ("2 hours", "30 minutes")
   - Warning event scheduling and emission
   - Timer extension and cancellation logic
   - Persistence across application restarts

3. **Executor Service** (`src/main/services/executor.ts`)
   ```typescript
   interface Executor {
     execute(project: Project): Promise<Result<ExecutionResult>>;
     getRunning(): Execution[];
   }
   ```
   - Subprocess spawning for Terraform commands
   - Output capture (stdout/stderr) with streaming
   - Retry logic with exponential backoff
   - Concurrent execution management
   - Process cleanup and resource management

#### Testing Requirements
- Unit tests with mocked dependencies
- Integration tests with temporary directories
- Performance tests for file system operations
- Stress tests for concurrent operations

#### Deliverables
- [ ] File monitoring and project discovery system
- [ ] Timer-based scheduling with natural language parsing
- [ ] Command execution with retry logic and output capture
- [ ] Performance benchmarks for file operations

---

### Stream 4: Notification & IPC Bridge
**Lead Developer**: Frontend/Integration Developer
**Timeline**: Week 2-4
**Dependencies**: Stream 1 (types), Stream 3 (services for events)

#### Tasks
1. **Notifier Service** (`src/main/services/notifier.ts`)
   ```typescript
   interface Notifier {
     notify(notification: Notification): Result<void>;
     scheduleWarning(project: Project, time: number): void;
     playSound(sound: SoundType): void;
   }
   ```
   - macOS system notification integration
   - Sound alerts with configurable tones
   - Warning scheduling with multiple intervals
   - Notification queuing and rate limiting

2. **IPC Bridge** (`src/main/ipc/` and `src/preload.ts`)
   ```typescript
   // Main process handlers
   ipcMain.handle('get-projects', async () => {
     return scheduler.getActive();
   });

   // Preload script API
   contextBridge.exposeInMainWorld('electronAPI', {
     getProjects: () => ipcRenderer.invoke('get-projects'),
     extendTimer: (id, duration) => ipcRenderer.invoke('extend-timer', id, duration)
   });
   ```
   - Secure IPC communication patterns
   - Real-time event streaming from main to renderer
   - Command interface for UI actions
   - Type-safe IPC with proper error handling

3. **State Management Bridge**
   - Event subscription system for UI updates
   - State synchronization between processes
   - Real-time countdown updates
   - Error propagation to UI

#### Testing Requirements
- Unit tests for notification logic
- IPC communication tests
- Event emission and subscription tests
- Integration tests with mocked system APIs

#### Deliverables
- [ ] System notification integration
- [ ] Complete IPC bridge with type safety
- [ ] Real-time event streaming to UI
- [ ] State synchronization system

---

### Stream 5: React UI Components
**Lead Developer**: Frontend/UI Developer
**Timeline**: Week 3-4 (depends on IPC bridge)
**Dependencies**: Stream 1 (types), Stream 4 (IPC bridge)

#### Tasks
1. **Core Components** (`src/renderer/components/`)
   ```tsx
   // ProjectItem component with countdown timer
   interface ProjectItemProps {
     project: Project;
     onExtend: (duration: string) => void;
     onCancel: () => void;
   }
   ```
   - ProjectItem with real-time countdown
   - CountdownTimer with color-coded warnings
   - ActionButtons for extend/cancel operations
   - ProjectList with virtual scrolling
   - RecentActivity for execution history

2. **Menu Dropdown** (`src/renderer/components/Menu/`)
   - Dropdown positioning relative to tray icon
   - Proper focus management and keyboard navigation
   - Auto-hide on window blur
   - Responsive layout for varying content

3. **Settings Interface** (`src/renderer/components/Settings/`)
   - Watch directory configuration
   - Ignore pattern management
   - Notification preferences
   - Sound configuration

4. **State Management** (`src/renderer/hooks/` and `src/renderer/contexts/`)
   ```tsx
   const useProjects = () => {
     const [projects, setProjects] = useState<Project[]>([]);
     // Real-time updates via IPC
   };
   ```
   - Custom hooks for data fetching
   - React Context for global state
   - Real-time updates from main process
   - Optimistic UI updates

#### Testing Requirements
- Component tests with React Testing Library
- User interaction tests
- Real-time update tests
- Accessibility testing

#### Deliverables
- [ ] Complete React-based menu interface
- [ ] Real-time countdown displays with animations
- [ ] User controls for timer management
- [ ] Settings interface for configuration
- [ ] Responsive and accessible UI components

---

## Integration Phase (Week 4-5)

### Integration Testing
After all streams complete their individual deliverables:

1. **Service Integration**
   - Test complete workflow: discovery → scheduling → execution
   - Cross-service communication validation
   - Error propagation across service boundaries
   - Performance testing under load

2. **UI Integration**
   - End-to-end user workflows
   - Real-time update synchronization
   - Error handling in UI components
   - Menu positioning and focus behavior

3. **System Integration**
   - File system operations on various macOS versions
   - Permission handling and error recovery
   - Resource usage optimization
   - Application lifecycle management

### Performance Optimization
- Memory usage profiling and optimization
- CPU usage during file scanning
- UI responsiveness under load
- Database query optimization

## Quality Gates

### Code Quality Requirements
Each stream must meet these standards before integration:

1. **Functional Programming Compliance**
   - No global variables or mutable state
   - Pure functions where possible
   - Result type usage for error handling
   - Immutable data structures

2. **Testing Requirements**
   - 85%+ unit test coverage
   - All critical paths tested
   - Error scenarios covered
   - Performance benchmarks established

3. **TypeScript Standards**
   - Strict mode compliance
   - No `any` types (except for external libraries)
   - Complete interface definitions
   - Proper error type definitions

4. **Documentation Requirements**
   - Function documentation with examples
   - Interface documentation
   - Error condition documentation
   - Performance characteristics

### Integration Readiness Checklist

- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] No memory leaks detected
- [ ] TypeScript compilation without errors
- [ ] ESLint passing without warnings
- [ ] Performance benchmarks within targets

## Risk Management

### Technical Risks & Mitigation

1. **File System Performance**
   - Risk: Slow scanning of large directories
   - Mitigation: Implement incremental scanning and caching

2. **Process Management**
   - Risk: Terraform subprocess hanging or failing
   - Mitigation: Implement timeouts and cleanup procedures

3. **Memory Usage**
   - Risk: Memory leaks from timers or file watchers
   - Mitigation: Implement proper cleanup and resource management

4. **UI Responsiveness**
   - Risk: Blocking UI during intensive operations
   - Mitigation: Use Web Workers or async patterns

### Development Risks & Mitigation

1. **Interface Evolution**
   - Risk: Interface changes breaking dependent streams
   - Solution: Lock interfaces early, use semantic versioning

2. **Integration Conflicts**
   - Risk: Components not working together
   - Solution: Daily integration testing and communication

3. **Timeline Dependencies**
   - Risk: Stream delays blocking dependent work
   - Solution: Robust mocking allows parallel development

## Success Metrics

### Functional Success Criteria
- [ ] Discovers `.killall.yaml` files in watched directories
- [ ] Parses natural language durations correctly
- [ ] Displays countdown timers with proper color coding
- [ ] Executes terraform commands successfully
- [ ] Handles failures with retry logic
- [ ] Provides timer extension and cancellation
- [ ] Shows system notifications at warning intervals
- [ ] Maintains complete audit log

### Performance Success Criteria
- [ ] Application startup < 2 seconds
- [ ] Memory usage < 100MB at idle, < 200MB active
- [ ] File system scanning handles 10,000+ files efficiently
- [ ] UI interactions respond in < 100ms
- [ ] Database operations complete in < 50ms

### Quality Success Criteria
- [ ] 85%+ test coverage across all components
- [ ] Zero TypeScript errors in strict mode
- [ ] Zero memory leaks in 24-hour stress test
- [ ] Handles all documented error scenarios
- [ ] Follows functional programming standards

## Communication Plan

### Daily Standups (15 minutes)
- Progress on current tasks
- Blockers or dependencies needed
- Interface changes or discoveries
- Integration readiness updates

### Weekly Integration Reviews (1 hour)
- Demo working components
- Integration test results
- Performance metrics review
- Next week planning and dependencies

### Documentation Updates
- README.md updates with progress
- CHANGELOG.md entries for completed features
- Architecture updates for implementation details
- Performance benchmark documentation

This implementation plan ensures that all developers can work efficiently in parallel while maintaining the high standards established in our development guidelines and producing a robust, well-tested application.