import React from 'react';

import { Project } from '../../shared/types';

import ProjectItem from './ProjectItem';
import './ProjectList.css';

interface ProjectListProps {
  activeProjects: Project[];
  recentProjects: Project[];
}

const ProjectList: React.FC<ProjectListProps> = ({ activeProjects, recentProjects }) => {
  return (
    <div className="project-list">
      {activeProjects.length > 0 && (
        <div className="project-section">
          <h3 className="section-title">Active Infrastructure</h3>
          <div className="project-items">
            {activeProjects.map(project => (
              <ProjectItem key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {recentProjects.length > 0 && (
        <div className="project-section">
          <h3 className="section-title">Recent Activity</h3>
          <div className="project-items">
            {recentProjects.map(project => (
              <ProjectItem key={project.id} project={project} />
            ))}
          </div>
        </div>
      )}

      {activeProjects.length === 0 && recentProjects.length === 0 && (
        <div className="empty-state">
          <p className="empty-message">No projects found</p>
          <p className="empty-hint">Add .killall.yaml files to your projects to start tracking them</p>
        </div>
      )}
    </div>
  );
};

export default ProjectList;