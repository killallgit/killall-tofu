import React, { useState } from 'react';

import { Project, ProjectStatus } from '../shared/types';

import ProjectList from './components/ProjectList';
import Header from './components/Header';
import './App.css';

const mockProjects: Project[] = [
  {
    id: '1',
    path: '/Users/developer/projects/aws-infrastructure',
    status: 'scheduled' as ProjectStatus,
    discoveredAt: new Date(Date.now() - 3600000),
    destroyAt: new Date(Date.now() + 7200000),
    config: {
      version: 1,
      timeout: '2 hours',
      name: 'AWS Development Stack',
      tags: ['aws', 'development'],
      command: 'terraform destroy -auto-approve'
    }
  },
  {
    id: '2', 
    path: '/Users/developer/projects/test-environment',
    status: 'scheduled' as ProjectStatus,
    discoveredAt: new Date(Date.now() - 1800000),
    destroyAt: new Date(Date.now() + 900000),
    config: {
      version: 1,
      timeout: '30 minutes',
      name: 'Testing Environment',
      tags: ['testing', 'temporary'],
      command: 'docker-compose down -v'
    }
  },
  {
    id: '3',
    path: '/Users/developer/projects/staging-cluster',
    status: 'destroying' as ProjectStatus,
    discoveredAt: new Date(Date.now() - 7200000),
    destroyAt: new Date(Date.now() - 60000),
    config: {
      version: 1,
      timeout: '4 hours',
      name: 'Staging Kubernetes Cluster',
      tags: ['kubernetes', 'staging'],
      command: 'kubectl delete namespace staging'
    }
  },
  {
    id: '4',
    path: '/Users/developer/projects/dev-database',
    status: 'destroyed' as ProjectStatus,
    discoveredAt: new Date(Date.now() - 14400000),
    destroyAt: new Date(Date.now() - 7200000),
    config: {
      version: 1,
      timeout: '1 hour',
      name: 'Dev Database Instance',
      tags: ['database', 'development']
    }
  }
];

function App() {
  const [projects] = useState<Project[]>(mockProjects);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredProjects = projects.filter(project => {
    const searchLower = searchTerm.toLowerCase();
    const name = project.config.name?.toLowerCase() || '';
    const path = project.path.toLowerCase();
    const tags = project.config.tags?.join(' ').toLowerCase() || '';
    
    return name.includes(searchLower) || 
           path.includes(searchLower) ||
           tags.includes(searchLower);
  });

  const activeProjects = filteredProjects.filter(p => 
    ['scheduled', 'destroying'].includes(p.status)
  );

  const recentProjects = filteredProjects.filter(p => 
    ['destroyed', 'failed', 'cancelled'].includes(p.status)
  );

  return (
    <div className="app">
      <Header 
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        activeCount={activeProjects.length}
      />
      
      <div className="app-content">
        <ProjectList 
          activeProjects={activeProjects}
          recentProjects={recentProjects}
        />
      </div>

      <div className="app-footer">
        <button className="settings-button">
          Settings
        </button>
        <button className="quit-button">
          Quit
        </button>
      </div>
    </div>
  );
}

export default App;