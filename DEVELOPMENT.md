# Killall-Tofu Development Guide

## Quick Start

```bash
# Clone and setup
git clone https://github.com/yourusername/killall-tofu.git
cd killall-tofu
npm install

# Start development environment
npm run start
```

## Prerequisites

### System Requirements
- **macOS 10.15+** (Catalina or later)
- **Node.js 18+** with npm
- **Xcode Command Line Tools** (`xcode-select --install`)

### Development Tools
- **TypeScript 4.5+** (included in dependencies)
- **Visual Studio Code** (recommended) with extensions:
  - TypeScript and JavaScript Language Features
  - ESLint
  - Prettier
  - Jest Runner

## Environment Setup

### 1. Repository Setup
```bash
# Clone repository
git clone https://github.com/yourusername/killall-tofu.git
cd killall-tofu

# Install dependencies
npm install

# Verify setup
npm run lint  # Should pass without errors
```

### 2. Development Environment
```bash
# Start development server (with hot reload)
npm run start

# The application will launch with:
# - Menu bar tray icon
# - Hot reload for TypeScript changes
# - DevTools available in renderer process
```

### 3. Testing Setup (Phase 2)
```bash
# Install testing dependencies (when implementing Phase 2)
npm install --save-dev jest @types/jest ts-jest
npm install --save-dev @testing-library/react @testing-library/jest-dom

# Run tests
npm run test           # Run all tests
npm run test:watch     # Watch mode for development
npm run test:coverage  # Generate coverage report
```

## Project Structure

### Current Structure (Phase 1)
```
killall-tofu/
├── src/
│   ├── index.ts       # Main Electron process (164 lines)
│   ├── preload.ts     # IPC bridge (minimal)
│   ├── renderer.ts    # React renderer entry point
│   └── index.css      # Basic styling
├── webpack.*.config.ts # Webpack configuration files
├── forge.config.ts     # Electron Forge configuration
├── tsconfig.json      # TypeScript configuration
├── package.json       # Dependencies and scripts
└── docs/              # Documentation files
    ├── ARCHITECTURE.md
    ├── SPECIFICATION.md
    ├── IMPLEMENTATION.md
    └── CLAUDE.md       # Development standards
```

### Planned Structure (Phase 2)
```
src/
├── main/              # Electron main process
│   ├── app.ts         # Application bootstrap
│   ├── tray.ts        # Menu bar tray management
│   ├── services/      # Core business logic
│   │   ├── watcher.ts     # File system monitoring
│   │   ├── scheduler.ts   # Timer management
│   │   ├── executor.ts    # Command execution
│   │   └── notifier.ts    # System notifications
│   ├── database/      # SQLite data layer
│   │   ├── index.ts       # Database service
│   │   ├── migrations/    # Schema versions
│   │   └── repositories/  # Data access layer
│   ├── config/        # Configuration management
│   │   ├── manager.ts     # Config loading/saving
│   │   └── validator.ts   # Schema validation
│   └── ipc/           # Inter-process communication
│       └── handlers.ts    # IPC message handlers
├── renderer/          # React UI components
│   ├── App.tsx        # Main application component
│   ├── components/    # React components
│   │   ├── ProjectItem.tsx
│   │   ├── CountdownTimer.tsx
│   │   ├── Menu/          # Menu dropdown components
│   │   └── Settings/      # Settings interface
│   ├── hooks/         # Custom React hooks
│   │   ├── useProjects.ts
│   │   └── useCountdown.ts
│   ├── contexts/      # State management
│   │   └── AppContext.tsx
│   └── styles/        # Component styling
└── shared/            # Shared code
    ├── types.ts       # TypeScript definitions
    └── utils/         # Helper functions
        ├── result.ts      # Result type utilities
        ├── duration.ts    # Duration parsing
        └── functional.ts  # Functional helpers
```

## Development Standards

### Code Style (Enforced by ESLint)
Following the functional programming standards in `CLAUDE.md`:

```typescript
// ✅ GOOD: Pure function with explicit dependencies
const calculateDestroyTime = (
  timeout: string,
  baseTime: Date = new Date()
): Result<Date> => {
  const result = parseTimeout(timeout);
  if (!result.ok) return result;
  
  return {
    ok: true,
    value: new Date(baseTime.getTime() + result.value)
  };
};

// ❌ BAD: Impure function with side effects
let globalTime: Date;
function setDestroyTime(timeout: string): void {
  globalTime = new Date(Date.now() + parseTimeout(timeout));
}
```

### Error Handling Pattern
```typescript
// Always use Result type for operations that can fail
type Result<T, E = Error> = 
  | { ok: true; value: T }
  | { ok: false; error: E };

// Implementation example
const parseConfig = (content: string): Result<Config> => {
  try {
    const config = yaml.parse(content);
    return { ok: true, value: config };
  } catch (error) {
    return { ok: false, error };
  }
};

// Usage example
const result = parseConfig(content);
if (result.ok) {
  console.log('Config loaded:', result.value);
} else {
  console.error('Failed to parse config:', result.error.message);
}
```

### Testing Patterns
```typescript
// Unit test structure
describe('calculateDestroyTime', () => {
  it('should calculate correct time for hours', () => {
    const baseTime = new Date('2025-01-01T12:00:00Z');
    const result = calculateDestroyTime('2 hours', baseTime);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(new Date('2025-01-01T14:00:00Z'));
    }
  });

  it('should handle invalid duration strings', () => {
    const result = calculateDestroyTime('invalid');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(Error);
    }
  });
});
```

## Development Workflow

### 1. Feature Development
```bash
# Create feature branch
git checkout -b feature/file-watcher-service

# Make changes following the standards
# Write tests first (TDD approach)
npm run test:watch

# Run linting
npm run lint

# Commit with conventional commits
git commit -m "feat(watcher): implement file system monitoring with chokidar"
```

### 2. Code Review Checklist
Before submitting a PR, ensure:

- [ ] All tests pass (`npm run test`)
- [ ] Linting passes (`npm run lint`) 
- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] No global variables or mutable state
- [ ] Functions are pure where possible
- [ ] Result types used for error-prone operations
- [ ] 85%+ test coverage for new code
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated with changes

### 3. Git Commit Convention
```bash
# Format: type(scope): description
feat(watcher): add file system monitoring
fix(scheduler): resolve timer memory leak
docs(readme): update installation instructions
test(executor): add subprocess timeout tests
refactor(database): extract repository pattern
```

## Available Scripts

### Development Scripts
```bash
npm run start          # Start Electron app in development mode
npm run lint           # Run ESLint on TypeScript files
npm run build          # Build TypeScript to JavaScript
```

### Production Scripts  
```bash
npm run package        # Package app for current platform
npm run make           # Create distributable (DMG on macOS)
npm run publish        # Publish to update server (future)
```

### Testing Scripts (Phase 2)
```bash
npm run test           # Run all tests once
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Generate coverage report
npm run test:e2e       # Run end-to-end tests
```

## Debugging

### Main Process Debugging
```bash
# Start with Node.js debugger
npm run start -- --inspect=5858

# In VS Code, use launch configuration:
{
  "type": "node",
  "request": "attach",
  "name": "Attach to Main",
  "port": 5858,
  "restart": true
}
```

### Renderer Process Debugging
- Open DevTools in the renderer window (Cmd+Option+I)
- Use browser debugging tools
- Console logs appear in DevTools console

### Common Issues

1. **"Module not found" errors**
   - Run `npm install` to ensure all dependencies are installed
   - Check import paths are correct
   - Verify TypeScript configuration

2. **Tray icon not appearing**
   - macOS permissions may need adjustment
   - Check Console.app for error messages
   - Restart the application

3. **Hot reload not working**
   - Restart the development server
   - Clear webpack cache: `rm -rf .webpack`

## Testing Strategy

### Unit Testing (Per Component)
- **Target**: 85%+ code coverage
- **Focus**: Pure functions, business logic, error handling
- **Tools**: Jest + TypeScript
- **Mocking**: All external dependencies

### Integration Testing
- **Focus**: Service-to-service communication
- **Database**: Use in-memory SQLite for testing
- **File System**: Use temporary directories
- **Processes**: Mock subprocess execution

### End-to-End Testing
- **Tools**: Playwright or Spectron
- **Scope**: Complete user workflows
- **Focus**: Menu interactions, real-time updates

## Performance Guidelines

### Optimization Targets
- Application startup: < 2 seconds
- Memory usage: < 100MB idle, < 200MB active  
- File scanning: Handle 10,000+ files efficiently
- UI interactions: < 100ms response time
- Database operations: < 50ms

### Profiling Tools
```bash
# Memory profiling
npm run start -- --inspect-brk --trace-gc

# CPU profiling  
npm run start -- --prof

# Bundle analysis
npm run analyze  # (when webpack-bundle-analyzer is added)
```

## Contributing Guidelines

### Pull Request Process
1. Create feature branch from `main`
2. Implement changes following coding standards
3. Add comprehensive tests (85%+ coverage)
4. Update documentation if needed
5. Update CHANGELOG.md with your changes
6. Submit PR with clear description

### Code Review Criteria
- Functional programming compliance
- Test coverage requirements met
- TypeScript strict mode passing
- No performance regressions
- Documentation completeness

### Release Process
1. Update version in `package.json`
2. Update CHANGELOG.md with release notes
3. Create release tag
4. Build and publish artifacts
5. Update documentation if needed

## Troubleshooting

### Development Environment Issues

**Problem**: TypeScript compilation errors
```bash
# Solution: Clear TypeScript cache
rm -rf node_modules/.cache
npm run build
```

**Problem**: Electron app won't start
```bash
# Solution: Rebuild native modules
npm run rebuild
```

**Problem**: File watcher not working
- Check file system permissions
- Verify watch directories exist
- Test with simple file changes

### Testing Issues

**Problem**: Tests timing out
- Increase Jest timeout in configuration
- Check for uncleaned async operations
- Ensure proper test isolation

**Problem**: Flaky tests
- Avoid time-dependent assertions
- Use proper async/await patterns
- Mock system-dependent operations

For additional help, see:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design details
- [SPECIFICATION.md](./SPECIFICATION.md) - Technical requirements
- [CLAUDE.md](./CLAUDE.md) - Coding standards
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Development roadmap