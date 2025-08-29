import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../../main/database/factory';
import type { Result } from '../../shared/types';

interface InitOptions {
  timeout: string;
  name?: string;
}

interface KillallConfig {
  version: number;
  timeout: string;
  name: string;
}

export const initCommand = new Command('init')
  .description('Initialize a killall-tofu project configuration')
  .option('--timeout <duration>', 'Set the destruction timeout (default: "2h")', '2h')
  .option('--name <name>', 'Set the project name (default: current directory name)')
  .action(async (options: InitOptions) => {
    try {
      await runInit(options);
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  });

async function runInit(options: InitOptions): Promise<void> {
  // Get current directory
  const cwd = process.cwd();
  
  // Check if .killall.yaml already exists
  const configPath = path.join(cwd, '.killall.yaml');
  if (fs.existsSync(configPath)) {
    throw new Error('.killall.yaml already exists in this directory');
  }

  // Use directory name as default project name if not provided
  const projectName = options.name || path.basename(cwd);

  // Create configuration
  const config: KillallConfig = {
    version: 1,
    timeout: options.timeout,
    name: projectName,
  };

  // Generate YAML content
  const yamlContent = yaml.dump(config);

  // Write .killall.yaml file
  fs.writeFileSync(configPath, yamlContent, 'utf8');
  console.log('✓ Created .killall.yaml');

  // Parse timeout to calculate destroy time
  const duration = parseDuration(options.timeout);
  if (!duration) {
    throw new Error(`Invalid timeout format: ${options.timeout}`);
  }

  const now = new Date();
  const destroyAt = new Date(now.getTime() + duration);

  // Register project in database
  const result = await registerProject({
    path: cwd,
    name: projectName,
    timeout: options.timeout,
    discoveredAt: now,
    destroyAt: destroyAt,
    config: yamlContent,
  });

  if (!result.ok) {
    throw new Error(`Failed to register project in database: ${(result as any).error.message}`);
  }

  console.log(`✓ Registered project in database (ID: ${result.value})`);
  console.log(`✓ Project will be destroyed at ${destroyAt.toISOString()}`);
  console.log('✓ Project now visible in Killall-Tofu menu bar app');
}

interface ProjectData {
  path: string;
  name: string;
  timeout: string;
  discoveredAt: Date;
  destroyAt: Date;
  config: string;
}

async function registerProject(project: ProjectData): Promise<Result<string>> {
  try {
    // Set up database path
    const homeDir = os.homedir();
    const dbPath = path.join(homeDir, '.killall', 'killall.db');
    
    // Check if database exists
    if (!fs.existsSync(dbPath)) {
      return {
        ok: false,
        error: new Error(`Killall-tofu database not found at ${dbPath}. Please ensure the main application is installed`),
      };
    }
    
    // Set environment variable for database path
    process.env.DATABASE_PATH = dbPath;
    process.env.USE_DRIZZLE = 'true';
    
    // Get database connection
    const dbResult = await getDatabase();
    if (!dbResult.ok) {
      return { ok: false, error: (dbResult as any).error };
    }

    const db = dbResult.value;
    
    // Prepare config JSON
    const configJson = {
      version: 1,
      timeout: project.timeout,
      name: project.name,
    };

    // Insert project using Drizzle repository pattern
    const repository = db.projects;
    
    const createResult = await repository.create({
      path: project.path,
      name: project.name,
      config: JSON.stringify(configJson),
      discoveredAt: project.discoveredAt,
      destroyAt: project.destroyAt,
      status: 'active' as const,
    });

    if (!createResult.ok) {
      return { ok: false, error: (createResult as any).error };
    }

    return { ok: true, value: createResult.value.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

function parseDuration(duration: string): number | null {
  const regex = /^(\d+)(h|m|s|d)$/;
  const match = duration.match(regex);
  
  if (!match) {
    // Try parsing complex durations like "1h30m"
    let totalMs = 0;
    const parts = duration.match(/(\d+)([hms])/g);
    
    if (!parts) return null;
    
    for (const part of parts) {
      const partMatch = part.match(/(\d+)([hms])/);
      if (!partMatch) return null;
      
      const value = parseInt(partMatch[1], 10);
      const unit = partMatch[2];
      
      switch (unit) {
        case 'h':
          totalMs += value * 60 * 60 * 1000;
          break;
        case 'm':
          totalMs += value * 60 * 1000;
          break;
        case 's':
          totalMs += value * 1000;
          break;
        default:
          return null;
      }
    }
    
    return totalMs > 0 ? totalMs : null;
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    case 's':
      return value * 1000;
    default:
      return null;
  }
}