/**
 * Sample project structures for testing
 */

import { Project, ProjectConfig, Execution } from '../../types';

// Project configurations
export const SAMPLE_CONFIGS: Record<string, ProjectConfig> = {
  basic: {
    version: 1,
    timeout: '1 hour',
    name: 'basic-project',
    tags: ['test', 'basic'],
  },

  terraform: {
    version: 1,
    timeout: '2 hours',
    name: 'terraform-project',
    command: 'terraform destroy -auto-approve',
    tags: ['terraform', 'infrastructure'],
    execution: {
      retries: 3,
      environment: {
        TF_VAR_env: 'test',
        AWS_REGION: 'us-east-1',
      },
      workingDirectory: './terraform',
      shell: '/bin/bash',
    },
    hooks: {
      beforeDestroy: [
        'echo "Starting terraform destroy"',
        'terraform plan -destroy',
      ],
      afterDestroy: [
        'echo "Terraform destroy completed"',
        'rm -rf .terraform/',
      ],
      onFailure: [
        'echo "Terraform destroy failed"',
        'terraform state list',
      ],
    },
  },

  docker: {
    version: 1,
    timeout: '30 minutes',
    name: 'docker-project',
    command: 'docker-compose down --volumes',
    tags: ['docker', 'containers'],
    execution: {
      retries: 2,
      environment: {
        COMPOSE_PROJECT_NAME: 'test-project',
      },
      workingDirectory: './docker',
    },
    hooks: {
      beforeDestroy: [
        'docker-compose logs > ./logs/final.log',
      ],
      afterDestroy: [
        'docker system prune -f',
      ],
    },
  },

  kubernetes: {
    version: 1,
    timeout: '45 minutes',
    name: 'k8s-project',
    command: 'kubectl delete -f manifests/',
    tags: ['kubernetes', 'k8s', 'orchestration'],
    execution: {
      retries: 3,
      environment: {
        KUBECONFIG: './kubeconfig',
        NAMESPACE: 'test-namespace',
      },
    },
    hooks: {
      beforeDestroy: [
        'kubectl get all -n $NAMESPACE',
        'kubectl get pvc -n $NAMESPACE',
      ],
      afterDestroy: [
        'kubectl delete namespace $NAMESPACE --ignore-not-found',
      ],
    },
  },

  nodejs: {
    version: 1,
    timeout: '15 minutes',
    name: 'nodejs-project',
    command: 'npm run cleanup',
    tags: ['nodejs', 'javascript', 'cleanup'],
    execution: {
      retries: 1,
      environment: {
        NODE_ENV: 'test',
      },
    },
    hooks: {
      beforeDestroy: [
        'npm run test:cleanup',
      ],
      afterDestroy: [
        'rm -rf node_modules/.cache',
        'rm -rf dist/',
      ],
    },
  },
};

// Helper function to create a project with a specific config
export const createProjectWithConfig = (
  configName: keyof typeof SAMPLE_CONFIGS,
  overrides: Partial<Project> = {}
): Project => {
  const config = SAMPLE_CONFIGS[configName];
  const baseId = Math.random().toString(36).substring(2, 15);
  
  return {
    id: `project_${configName}_${baseId}`,
    path: `/projects/${configName}`,
    config,
    discoveredAt: new Date(),
    destroyAt: new Date(Date.now() + parseDurationToMs(config.timeout)),
    status: 'discovered',
    ...overrides,
  };
};

// Helper function to parse duration to milliseconds
function parseDurationToMs(duration: string): number {
  const match = duration.match(/(\d+)\s*(minute|minutes|hour|hours|day|days)/i);
  if (!match) return 60 * 60 * 1000; // Default 1 hour

  const [, num, unit] = match;
  const value = parseInt(num, 10);

  switch (unit.toLowerCase()) {
    case 'minute':
    case 'minutes':
      return value * 60 * 1000;
    case 'hour':
    case 'hours':
      return value * 60 * 60 * 1000;
    case 'day':
    case 'days':
      return value * 24 * 60 * 60 * 1000;
    default:
      return 60 * 60 * 1000;
  }
}

// Sample projects for testing
export const SAMPLE_PROJECTS: Record<string, Project> = {
  basicProject: createProjectWithConfig('basic'),
  terraformProject: createProjectWithConfig('terraform', {
    status: 'scheduled',
    destroyAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
  }),
  dockerProject: createProjectWithConfig('docker', {
    status: 'destroying',
  }),
  k8sProject: createProjectWithConfig('kubernetes', {
    status: 'discovered' as const,
  } as Partial<Project>),
  nodejsProject: createProjectWithConfig('nodejs', {
    status: 'failed',
    metadata: {
      lastError: 'NPM cleanup script failed',
      retryCount: 2,
    },
  }),
};

// Sample executions
export const SAMPLE_EXECUTIONS: Execution[] = [
  {
    id: 'exec_1',
    projectId: SAMPLE_PROJECTS.terraformProject.id,
    startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    completedAt: new Date(Date.now() - 25 * 60 * 1000), // 25 minutes ago
    status: 'completed',
    exitCode: 0,
    duration: 5 * 60 * 1000, // 5 minutes
    stdout: 'Terraform destroy completed successfully\nAll resources destroyed',
  },
  {
    id: 'exec_2',
    projectId: SAMPLE_PROJECTS.dockerProject.id,
    startedAt: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
    status: 'running',
  },
  {
    id: 'exec_3',
    projectId: SAMPLE_PROJECTS.nodejsProject.id,
    startedAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
    completedAt: new Date(Date.now() - 58 * 60 * 1000), // 58 minutes ago
    status: 'failed',
    exitCode: 1,
    duration: 2 * 60 * 1000, // 2 minutes
    stderr: 'Error: NPM cleanup script failed\nModule not found: cleanup-script',
  },
  {
    id: 'exec_4',
    projectId: SAMPLE_PROJECTS.k8sProject.id,
    startedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
    completedAt: new Date(Date.now() - 3 * 60 * 1000), // 3 minutes ago
    status: 'timeout',
    exitCode: 124,
    duration: 2 * 60 * 1000, // 2 minutes
    stderr: 'Execution timed out after 2 minutes',
  },
];

// Project collections for different scenarios
export const PROJECT_COLLECTIONS = {
  discovered: Object.values(SAMPLE_PROJECTS).filter(p => p.status === 'discovered'),
  scheduled: Object.values(SAMPLE_PROJECTS).filter(p => p.status === 'scheduled'),
  active: Object.values(SAMPLE_PROJECTS).filter(p => 
    ['destroying', 'scheduled'].includes(p.status)
  ),
  failed: Object.values(SAMPLE_PROJECTS).filter(p => p.status === 'failed'),
  byTag: (tag: string) => Object.values(SAMPLE_PROJECTS).filter(p =>
    p.config.tags?.includes(tag) || false
  ),
  withTimeout: (hours: number) => Object.values(SAMPLE_PROJECTS).filter(p => {
    const timeoutMs = parseDurationToMs(p.config.timeout);
    return timeoutMs === hours * 60 * 60 * 1000;
  }),
};

// Execution collections
export const EXECUTION_COLLECTIONS = {
  completed: SAMPLE_EXECUTIONS.filter(e => e.status === 'completed'),
  failed: SAMPLE_EXECUTIONS.filter(e => e.status === 'failed'),
  running: SAMPLE_EXECUTIONS.filter(e => e.status === 'running'),
  timeout: SAMPLE_EXECUTIONS.filter(e => e.status === 'timeout'),
  byProject: (projectId: string) => SAMPLE_EXECUTIONS.filter(e => e.projectId === projectId),
  recent: (minutes: number) => SAMPLE_EXECUTIONS.filter(e => {
    const cutoff = Date.now() - minutes * 60 * 1000;
    return e.startedAt.getTime() > cutoff;
  }),
};