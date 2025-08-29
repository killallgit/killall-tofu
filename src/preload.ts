import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

import type { Project, ProjectStatus, AppConfig, NotificationMessage } from './shared/types';

// Define the API that will be exposed to the renderer process
interface KillallTofuAPI {
  // Project operations
  projects: {
    getAll: () => Promise<Project[]>;
    getActive: () => Promise<Project[]>;
    getByStatus: (status: ProjectStatus) => Promise<Project[]>;
    cancel: (projectId: string) => Promise<void>;
    extend: (projectId: string, additionalTime: string) => Promise<void>;
    destroy: (projectId: string) => Promise<void>;
  };
  
  // Configuration operations
  config: {
    get: () => Promise<AppConfig>;
    update: (config: Partial<AppConfig>) => Promise<AppConfig>;
    addWatchDirectory: (path: string) => Promise<void>;
    removeWatchDirectory: (path: string) => Promise<void>;
    resetToDefaults: () => Promise<void>;
  };
  
  // Notification operations
  notifications: {
    subscribe: (callback: (message: NotificationMessage) => void) => () => void;
    test: () => Promise<void>;
  };
  
  // App operations
  app: {
    quit: () => void;
    minimize: () => void;
    openExternal: (url: string) => Promise<void>;
    getVersion: () => Promise<string>;
    checkForUpdates: () => Promise<boolean>;
  };
  
  // File operations (limited and secure)
  files: {
    selectDirectory: () => Promise<string | null>;
    openLogsFolder: () => Promise<void>;
  };
}

// Create secure API implementation using IPC
const createAPI = (): KillallTofuAPI => ({
  projects: {
    getAll: () => ipcRenderer.invoke('projects:getAll'),
    getActive: () => ipcRenderer.invoke('projects:getActive'),
    getByStatus: (status) => ipcRenderer.invoke('projects:getByStatus', status),
    cancel: (projectId) => ipcRenderer.invoke('projects:cancel', projectId),
    extend: (projectId, additionalTime) => 
      ipcRenderer.invoke('projects:extend', projectId, additionalTime),
    destroy: (projectId) => ipcRenderer.invoke('projects:destroy', projectId),
  },
  
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    update: (config) => ipcRenderer.invoke('config:update', config),
    addWatchDirectory: (path) => ipcRenderer.invoke('config:addWatchDirectory', path),
    removeWatchDirectory: (path) => ipcRenderer.invoke('config:removeWatchDirectory', path),
    resetToDefaults: () => ipcRenderer.invoke('config:resetToDefaults'),
  },
  
  notifications: {
    subscribe: (callback) => {
      const handler = (_event: IpcRendererEvent, message: NotificationMessage) => {
        callback(message);
      };
      ipcRenderer.on('notification:message', handler);
      
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener('notification:message', handler);
      };
    },
    test: () => ipcRenderer.invoke('notifications:test'),
  },
  
  app: {
    quit: () => ipcRenderer.send('app:quit'),
    minimize: () => ipcRenderer.send('app:minimize'),
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
  },
  
  files: {
    selectDirectory: () => ipcRenderer.invoke('files:selectDirectory'),
    openLogsFolder: () => ipcRenderer.invoke('files:openLogsFolder'),
  },
});

// Expose the API to the renderer process in a secure way
contextBridge.exposeInMainWorld('killallTofu', createAPI());

// Type augmentation for window object
declare global {
  interface Window {
    killallTofu: KillallTofuAPI;
  }
}

// Export types for use in renderer
export type { KillallTofuAPI };