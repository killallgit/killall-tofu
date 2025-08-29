import { Project } from '../../shared/types';

export interface ExecutorConfig {
  environment?: Record<string, string>;
}

/**
 * Build execution environment from base config and project-specific overrides
 */
export const buildExecutionEnvironment = (
  baseConfig: ExecutorConfig,
  project: Project
): Record<string, string> => {
  const baseEnv = { ...baseConfig.environment };
  
  // Add project-specific environment variables if provided
  const projectConfig = typeof project.config === 'string' 
    ? JSON.parse(project.config) 
    : project.config;
    
  if (projectConfig?.execution?.environment) {
    Object.assign(baseEnv, projectConfig.execution.environment);
  }

  return baseEnv;
};

/**
 * Filter sensitive environment variables for logging
 */
export const filterSensitiveEnvVars = (env: Record<string, string>): Record<string, string> => {
  const filtered: Record<string, string> = {};
  const sensitiveKeys = ['password', 'secret', 'key', 'token', 'auth', 'credential'];
  
  for (const [key, value] of Object.entries(env)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
    
    filtered[key] = isSensitive ? '***' : value;
  }
  
  return filtered;
};

/**
 * Validate environment variables
 */
export const validateEnvironment = (env: Record<string, string>): boolean => {
  return Object.entries(env).every(([key, value]) => 
    typeof key === 'string' && key.length > 0 && typeof value === 'string'
  );
};