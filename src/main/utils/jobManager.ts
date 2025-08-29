export interface ScheduledJob {
  id: string;
  projectId: string;
  destroyAt: Date;
  timeoutId: NodeJS.Timeout;
  type: 'destruction' | 'warning';
  warningMinutes?: number;
}

/**
 * Generate unique job ID
 */
export const generateJobId = (projectId: string, type: 'destruction' | 'warning', warningMinutes?: number): string => {
  const suffix = warningMinutes ? `_warn_${warningMinutes}` : '_destroy';
  return `${projectId}${suffix}`;
};

/**
 * Create a scheduled job
 */
export const createScheduledJob = (
  projectId: string,
  destroyAt: Date,
  timeoutId: NodeJS.Timeout,
  type: 'destruction' | 'warning',
  warningMinutes?: number
): ScheduledJob => {
  return {
    id: generateJobId(projectId, type, warningMinutes),
    projectId,
    destroyAt,
    timeoutId,
    type,
    warningMinutes
  };
};

/**
 * Cancel and remove job from map
 */
export const cancelJob = (job: ScheduledJob): void => {
  clearTimeout(job.timeoutId);
};

/**
 * Cancel all jobs for a specific project
 */
export const cancelProjectJobs = (projectId: string, jobs: Map<string, ScheduledJob>): ScheduledJob[] => {
  const cancelledJobs: ScheduledJob[] = [];
  
  for (const [jobId, job] of jobs.entries()) {
    if (job.projectId === projectId) {
      cancelJob(job);
      jobs.delete(jobId);
      cancelledJobs.push(job);
    }
  }
  
  return cancelledJobs;
};

/**
 * Get jobs scheduled for a specific project
 */
export const getProjectJobs = (projectId: string, jobs: Map<string, ScheduledJob>): ScheduledJob[] => {
  return Array.from(jobs.values()).filter(job => job.projectId === projectId);
};

/**
 * Check if job exists for project and type
 */
export const hasJobForProject = (
  projectId: string, 
  type: 'destruction' | 'warning',
  jobs: Map<string, ScheduledJob>,
  warningMinutes?: number
): boolean => {
  const jobId = generateJobId(projectId, type, warningMinutes);
  return jobs.has(jobId);
};