# Changelog

All notable changes to Killall-Tofu will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project setup with Electron Forge TypeScript template
- Menu bar application structure with tray icon integration
- Complete technical specification and architecture documentation
- Development standards and functional programming guidelines
- React-based dropdown UI for infrastructure management
- TypeScript types and interfaces for all core entities
- Project discovery system design (file watcher service)
- Scheduler service for timer management
- Executor service for terraform command execution
- Database schema for projects, executions, and events
- Configuration management system with YAML support
- Notification system with warning intervals
- Basic React components for project display with countdown timers

### Technical
- Electron v28+ with TypeScript 5.0+ configuration
- React 18 with JSX support and strict mode
- SQLite3 database integration
- File watching with chokidar
- YAML configuration parsing with js-yaml
- Logging infrastructure with winston
- Menu bar positioning and focus management
- Single instance application enforcement
- macOS dock hiding for clean menu bar experience

### Documentation
- `SPECIFICATION.md` - Complete technical specification with 32 implementation tasks
- `ARCHITECTURE.md` - Detailed system design and component architecture  
- `CLAUDE.md` - Development standards enforcing functional programming principles
- `README.md` - User-friendly project overview with usage examples

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