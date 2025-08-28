-- Migration: Create app_configurations table for Configuration Manager
-- Version: 2
-- Description: Add configuration storage table for application settings

CREATE TABLE IF NOT EXISTS app_configurations (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

-- Index for faster lookups (though not strictly needed with single config)
CREATE INDEX IF NOT EXISTS idx_app_configurations_updated_at ON app_configurations(updated_at);