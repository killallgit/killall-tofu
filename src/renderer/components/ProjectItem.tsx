import React from 'react';
import { Project } from '../../shared/types';
import './ProjectItem.css';

interface ProjectItemProps {
  project: Project;
}

const getTimeRemaining = (destroyAt: Date): string => {
  const now = new Date();
  const diff = destroyAt.getTime() - now.getTime();
  
  if (diff <= 0) return 'Now';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
};

const getStatusColor = (project: Project): string => {
  const now = new Date();
  const timeRemaining = project.destroyAt.getTime() - now.getTime();
  
  if (project.status === 'destroying') return 'status-destroying';
  if (project.status === 'destroyed') return 'status-completed';
  if (project.status === 'failed') return 'status-failed';
  if (project.status === 'cancelled') return 'status-cancelled';
  
  if (timeRemaining < 15 * 60 * 1000) return 'status-critical';
  if (timeRemaining < 60 * 60 * 1000) return 'status-warning';
  return 'status-normal';
};

const ProjectItem: React.FC<ProjectItemProps> = ({ project }) => {
  const isActive = ['scheduled', 'destroying'].includes(project.status);
  const statusColor = getStatusColor(project);
  
  return (
    <div className={`project-item ${statusColor}`}>
      <div className="project-header">
        <div className="project-name">
          {project.config.name || 'Unnamed Project'}
        </div>
        {isActive && project.status !== 'destroying' && (
          <div className="project-time">
            {getTimeRemaining(project.destroyAt)}
          </div>
        )}
        {project.status === 'destroying' && (
          <div className="project-status">Destroying...</div>
        )}
      </div>
      
      <div className="project-path">{project.path}</div>
      
      {project.config.tags && project.config.tags.length > 0 && (
        <div className="project-tags">
          {project.config.tags.map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}
      
      {isActive && (
        <div className="project-actions">
          <button className="action-button extend-button">
            +30m
          </button>
          <button className="action-button cancel-button">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default ProjectItem;