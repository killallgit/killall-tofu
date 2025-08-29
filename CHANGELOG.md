# Changelog

All notable changes to Killall-Tofu will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

#### Drizzle ORM Migration - Phase 3: Performance Validation
- **Performance Benchmark Suite**: Comprehensive benchmarking infrastructure
  - `scripts/benchmark-drizzle.ts`: Head-to-head performance comparison
  - Tests for insert, query, update, delete, and complex operations
  - Batch operation performance testing
  - Automated comparison reporting with pass/fail criteria
- **Memory Leak Detection**: Advanced memory profiling tools
  - `scripts/memory-test.ts`: Memory leak detection for both implementations
  - Connection handling stress tests
  - CRUD operation memory profiling
  - Transaction rollback memory testing
  - Heap snapshot analysis with growth detection
- **Bundle Size Analysis**: Impact measurement tooling
  - `scripts/bundle-size-analysis.ts`: Automated bundle size comparison
  - Main and renderer process size tracking
  - Dependency size breakdown
  - Tree-shaking effectiveness validation
- **Performance Documentation**: Comprehensive validation reports
  - `docs/drizzle-performance-report.md`: Detailed benchmark results
  - `docs/migration-cutover-plan.md`: Production deployment strategy
  - Risk assessment and mitigation strategies
  - Rollback procedures with <1 minute recovery time
- **NPM Scripts**: Automated validation commands
  - `npm run benchmark`: Run performance benchmarks
  - `npm run benchmark:memory`: Memory leak detection
  - `npm run benchmark:bundle`: Bundle size analysis
  - `npm run benchmark:all`: Complete validation suite

### Technical
- **Performance Results**: Drizzle implementation validated
  - All operations within ±5% of raw SQL performance
  - Zero memory leaks detected in stress testing
  - Bundle size increase at target limit (10KB)
  - Type safety with 100% compile-time validation
- **Production Readiness**: Migration ready for deployment
  - Feature flag system (`USE_DRIZZLE`) fully operational
  - Gradual rollout strategy documented
  - Monitoring and alerting guidelines established
  - Zero breaking changes to existing APIs

### Fixed
- **Functional Programming Compliance**: Major refactoring to align with CLAUDE.md standards
  - Removed global variables from main Electron process (tray, mainWindow)
  - Replaced all `let` variables with `const` in production code
  - Converted error classes to factory functions with type guards
  - Fixed mutable state in debounce/throttle utilities using object wrappers
  - Refactored parseDuration to avoid mutable accumulator pattern

### Added
- **IPC Security Bridge**: Implemented secure preload script with contextBridge
  - Complete IPC API for projects, config, notifications, and app operations
  - Type-safe communication between main and renderer processes
  - Restricted file operations with validation
  - Event subscription/unsubscription patterns for notifications
- **Winston Logger Configuration**: Production-ready logging to replace console.log
  - Structured logging with multiple transports (console, file)
  - Service-specific loggers for better debugging
  - Timed operation helpers for performance monitoring
  - Automatic log rotation with size limits
  - Exception and rejection handlers

### Changed
- **Main Process Architecture**: Refactored to functional programming paradigm
  - Replaced global state with closure-based state management
  - Implemented factory functions for window and tray creation
  - Added proper IPC handler setup with security validation
  - Improved code organization with pure functions

### Technical
- **Test Infrastructure Updates**: Fixed test compatibility with new error factories
  - Updated validation tests to use createValidationError factory
  - Added type guards for error checking instead of instanceof
  - Fixed ConfigValidationError usage in test assertions
  - Resolved TypeScript errors from class-to-interface conversion

### Research
- **ORM Evaluation** (Issue #8) - Comprehensive analysis of TypeScript ORM options
  - Evaluated Drizzle, Prisma, Kysely, TypeORM, and MikroORM for SQLite/Electron compatibility
  - Created detailed comparison matrix with bundle sizes, dependencies, and TypeScript support
  - **Recommendation**: Drizzle ORM selected for 7.4KB bundle size and functional programming alignment
  - Developed complete migration strategy from raw SQL to Drizzle with 6-day timeline
  - Documented rollback strategy and performance benchmarks

### Added

#### Drizzle ORM Migration - Phase 2A: Repository Pattern Implementation
- **Base Repository Class**: Created abstract base repository with generic CRUD operations
  - Implements Result type pattern for consistent error handling
  - Transaction support with automatic error wrapping
  - ID generation utilities with customizable prefixes
  - Batch operation helper methods for performance
  - Pure functional approach with no global state
- **DrizzleProjectRepository**: Full implementation of ProjectRepository interface
  - All CRUD operations (create, update, delete, findById, findByPath)
  - Specialized queries (findActive, findByStatus, findExpiring, findOverdue)
  - Pagination support with limit/offset
  - Status counting for statistics
  - Composable query builders for reusability
- **DrizzleExecutionRepository**: Complete execution tracking implementation
  - Execution record creation and updates
  - Query methods (findByProject, findRunning, findByStatus, findFailed)
  - Latest execution retrieval per project
  - Execution statistics and cleanup methods
  - Proper handling of nullable fields with TypeScript
- **DrizzleEventRepository**: Comprehensive event logging implementation
  - Flexible event querying with multiple filter options
  - Time-based queries (since/until date ranges)
  - Event type and project-based filtering
  - Global event support (no project association)
  - Event statistics and cleanup utilities
- **Repository Factory**: Updated database factory for seamless switching
  - Feature flag support via USE_DRIZZLE environment variable
  - Maintains backward compatibility with raw SQL implementation
  - Common interface for both implementations
  - Zero code changes required in services
- **TypeScript Fixes**: Resolved all compilation issues
  - Fixed import paths for proper module resolution
  - Added missing enum values (queued, cancelled statuses)
  - Resolved Drizzle query builder type issues
  - Proper handling of nullable database fields

#### Drizzle ORM Migration - Phase 1B: Schema Definitions
- **Complete Schema Conversion**: All 4 tables converted to Drizzle schemas with TypeScript support
  - Projects table: UUID primary key, status enum, timestamp fields
  - Executions table: Foreign key to projects with cascade delete
  - Events table: Optional project reference with set null on delete
  - App Configurations table: Key-value storage for settings
- **TypeScript Type Generation**: Auto-inferred types for all tables
  - `Project`, `NewProject` types for projects table
  - `Execution`, `NewExecution` types for executions table
  - `Event`, `NewEvent` types for events table
  - `AppConfiguration`, `NewAppConfiguration` types for configs
- **Table Relations**: Defined relationships for query builder support
  - One-to-many: projects → executions
  - One-to-many: projects → events (optional)
- **Performance Indexes**: All existing indexes preserved
  - Projects: status, destroy_at, path indexes
  - Executions: project_id, status, started_at indexes
  - Events: project_id, event_type, timestamp indexes
  - Configurations: updated_at index
- **Type-safe Enums**: Exported constants for all enum fields
  - ProjectStatus, ExecutionStatus, EventType enums
  - ConfigKey constants for common configuration keys
- **Migration Generation**: Initial migration SQL generated successfully
  - Matches existing database schema exactly
  - No data loss or breaking changes

#### Drizzle ORM Migration - Phase 1A: Setup and Configuration
- **Drizzle ORM Installation**: Added drizzle-orm and better-sqlite3 dependencies for modern ORM support
- **Drizzle Kit Integration**: Configured drizzle-kit for migration generation and database management
- **Configuration File**: Created `drizzle.config.ts` with SQLite dialect configuration
- **Database Connection Module**: Implemented `src/main/database/drizzle/connection.ts` with Result types and retry logic
  - Connection pooling support with configurable options
  - WAL mode and foreign key enforcement for performance
  - Pure functional design with explicit error handling
- **Factory Pattern**: Created `src/main/database/factory.ts` for seamless migration between raw SQL and Drizzle
  - Feature flag system using `USE_DRIZZLE` environment variable
  - Type guards for implementation detection
  - Backward compatibility with existing DatabaseService
- **Database Management Scripts**: Added npm scripts for database operations
  - `db:generate` - Generate Drizzle migrations from schema
  - `db:migrate` - Apply migrations to database
  - `db:studio` - Launch Drizzle Studio for visual database management
  - `db:push` - Push schema changes directly (development)
- **Environment Configuration**: Added `.env.example` with database and feature flag settings
- **TypeScript Upgrade**: Updated TypeScript to latest version for compatibility with Drizzle types

### Technical
- Initial project setup with Electron Forge TypeScript template
- Menu bar application structure with tray icon integration
- Complete technical specification and architecture documentation
- Development standards and functional programming guidelines
- Comprehensive implementation roadmap with parallel development streams
- Developer onboarding documentation and setup instructions
- Testing strategy with coverage requirements and quality gates
- Current project status tracking and next steps documentation
- ESLint configuration enforcing functional programming standards
- Updated documentation with actionable implementation tasks

#### Database Service Implementation
- **SQLite Integration**: Complete database service with connection management, health checks, and statistics
- **Migration System**: Version-controlled schema migrations with rollback support and transaction safety
- **Repository Pattern**: Full CRUD operations for projects, executions, and events with functional programming compliance
- **Schema Design**: Production-ready database schema with proper indexes, foreign keys, and performance optimizations
- **Audit Logging**: Comprehensive event logging system for all infrastructure lifecycle events
- **Transaction Support**: ACID transactions for data consistency across multiple operations
- **Result Types**: Explicit error handling using Result<T, E> pattern throughout database layer
- **Health Monitoring**: Database health checks, statistics, and maintenance operations

#### Configuration Manager Service Implementation
- **Application Configuration**: Complete configuration management service with type-safe interfaces and validation
- **Database Persistence**: Configuration stored and retrieved using existing database service with transaction support
- **Section Management**: Organized configuration into logical sections (notifications, UI, behavior, watch directories)
- **Real-time Updates**: Event-driven configuration changes with subscription/unsubscription pattern
- **Backup & Restore**: Configuration backup to filesystem with restore functionality for data recovery
- **Validation System**: Comprehensive configuration validation with detailed error messages
- **Default Configuration**: Smart defaults with user home directory detection for watch paths
- **Watch Directory Management**: Add/remove project discovery directories with duplicate handling
- **Functional Compliance**: Pure functions, Result types, and immutable operations throughout

### Technical Improvements
- **Code Quality**: ESLint compliance with TypeScript strict mode, all warnings resolved for production code
- **Build System**: Verified package process works correctly with webpack bundling and native dependencies
- **Type Safety**: Complete TypeScript interface definitions with proper unused parameter handling
- **Functional Programming**: Code review completed with 69% compliance to functional programming standards
- **Development Workflow**: Task completion checklist established following CLAUDE.md development standards
- **File System Compatibility**: Fixed fs.constants import issue in project discovery service for better Jest compatibility

### In Progress - Phase 2 Core Development
- **Foundation & Testing Infrastructure** (Issue #4) - @claude assigned
  - Jest testing framework setup with TypeScript support
  - Mock service implementations for parallel development
  - Test fixtures and comprehensive testing strategy
- **File Watcher Service** (Issue #9) - @claude assigned
  - Project discovery by scanning for .killall.yaml files
  - Configuration parsing and validation with js-yaml
  - File system monitoring using chokidar for real-time updates
  - Database integration for project persistence
- **Database Service** - ✅ COMPLETED
  - SQLite integration with connection management and health checks
  - Complete schema with migrations system (projects, executions, events tables)
  - Repository pattern implementation with full CRUD operations
  - Transaction support for data consistency
  - Functional programming compliance with Result types
- **Configuration Manager** - ✅ COMPLETED
  - Application configuration service with database persistence
  - Section-based configuration management (notifications, UI, behavior)
  - Event-driven updates with backup and restore functionality
  - Watch directory management for project discovery
- Service architecture implementation (scheduler, executor)
- React UI components with countdown timers and project management
- IPC communication bridge between main and renderer processes
- System notification integration with warning intervals

### Technical Foundation Complete
- Electron 37.4.0 with TypeScript 4.5.4 configuration
- React 19 with modern JSX and strict mode
- Webpack build pipeline with hot reload development
- ESLint configuration with TypeScript rules
- Menu bar positioning and focus management
- Single instance application enforcement
- macOS dock hiding for clean menu bar experience

### Database Layer Complete
- **SQLite 5.1.7**: Production database with full ACID compliance
- **Schema v1**: Complete table design (projects, executions, events, schema_migrations)
- **Migration Framework**: Version-controlled database evolution with rollback support
- **Repository Architecture**: Clean separation of data access with dependency injection
- **Performance Indexes**: Optimized queries for common access patterns
- **Functional Compliance**: Result types, pure functions, immutable operations

### Documentation Complete
- `SPECIFICATION.md` - Technical specification with 32 implementation tasks
- `ARCHITECTURE.md` - System design with implementation priority matrix
- `CLAUDE.md` - Functional programming standards and development guidelines
- `README.md` - Updated with current status and developer onboarding
- `IMPLEMENTATION.md` - Detailed parallel development streams with 5 developer workflow
- `DEVELOPMENT.md` - Complete developer setup and testing instructions
- `.eslintrc.json` - Code quality enforcement aligned with functional programming standards

### Project Structure
- Electron main process for tray and window management
- React renderer process for UI components
- Shared TypeScript types and utilities
- Webpack configuration for development and production builds
- ESLint configuration following project standards

## Release Notes

### Version 0.1.0 (Initial Setup)

This release establishes the foundation for Killall-Tofu, a macOS menu bar application designed to automatically destroy Terraform infrastructure after specified timeouts.

**Key Features:**
- 🔥 Menu bar tray icon with context menu
- ⚛️ React-based dropdown interface
- 📋 Project list with countdown timers  
- 🎯 Timer extension and cancellation controls
- 📄 Comprehensive technical documentation

**Developer Experience:**
- Functional programming paradigms (no global variables, pure functions)
- Result types for explicit error handling
- TypeScript strict mode with full type safety
- Modern Electron Forge build system
- Hot reload development environment

**Architecture Highlights:**
- Event-driven service communication
- Dependency injection pattern
- Immutable state management
- Component-based UI architecture
- Comprehensive testing strategy

This release provides a solid foundation for the 4-phase implementation roadmap outlined in the technical specification.