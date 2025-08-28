-- Initial database schema for Killall-Tofu
-- Migration 001: Create core tables for projects, executions, and audit events

-- Projects table: Stores discovered infrastructure projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,                    -- UUID for project identification
    path TEXT NOT NULL UNIQUE,              -- Absolute filesystem path to project
    name TEXT,                              -- Optional display name from config
    config TEXT NOT NULL,                   -- JSON-serialized ProjectConfig
    discovered_at TIMESTAMP NOT NULL,       -- When project was first discovered
    destroy_at TIMESTAMP NOT NULL,          -- Scheduled destruction time
    status TEXT NOT NULL CHECK(
        status IN ('active', 'pending', 'destroying', 'destroyed', 'failed', 'cancelled')
    ),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Executions table: Command execution history and logs
CREATE TABLE IF NOT EXISTS executions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT NOT NULL,               -- Foreign key to projects table
    command TEXT NOT NULL,                  -- Full command that was executed
    working_dir TEXT NOT NULL,              -- Working directory for execution
    started_at TIMESTAMP NOT NULL,          -- When execution began
    completed_at TIMESTAMP,                 -- When execution finished (NULL if still running)
    exit_code INTEGER,                      -- Process exit code (NULL if still running)
    stdout TEXT,                            -- Standard output from command
    stderr TEXT,                            -- Standard error from command
    status TEXT NOT NULL CHECK(
        status IN ('running', 'completed', 'failed', 'timeout')
    ),
    attempt_number INTEGER DEFAULT 1,       -- Retry attempt number
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Events table: Audit log for all significant system events
CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,                        -- Optional foreign key to projects table
    event_type TEXT NOT NULL CHECK(
        event_type IN ('discovered', 'registered', 'warning', 'destroying', 
                      'destroyed', 'failed', 'cancelled', 'extended', 'error')
    ),
    details TEXT,                           -- Optional JSON-serialized event details
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

-- Performance indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_destroy_at ON projects(destroy_at);
CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);

CREATE INDEX IF NOT EXISTS idx_executions_project ON executions(project_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);
CREATE INDEX IF NOT EXISTS idx_executions_started_at ON executions(started_at);

CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);

-- Update trigger to maintain updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_projects_timestamp 
    AFTER UPDATE ON projects
    FOR EACH ROW 
    BEGIN
        UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;