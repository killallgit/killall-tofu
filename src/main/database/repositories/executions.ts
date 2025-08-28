import { Database as SQLiteDatabase } from 'sqlite3';

import { 
  Result, 
  Execution, 
  ExecutionRepository, 
  ExecutionStatus 
} from '../types';

export class ExecutionRepositoryImpl implements ExecutionRepository {
  private db: SQLiteDatabase;

  constructor(db: SQLiteDatabase) {
    this.db = db;
  }

  // Create a new execution record
  async create(executionData: Omit<Execution, 'id'>): Promise<Result<number>> {
    return new Promise((resolve) => {
      const sql = `
        INSERT INTO executions (
          project_id, command, working_dir, started_at, completed_at, 
          exit_code, stdout, stderr, status, attempt_number
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        executionData.projectId,
        executionData.command,
        executionData.workingDir,
        executionData.startedAt.toISOString(),
        executionData.completedAt?.toISOString() || null,
        executionData.exitCode || null,
        executionData.stdout || null,
        executionData.stderr || null,
        executionData.status,
        executionData.attemptNumber
      ];

      this.db.run(sql, params, function(err) {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          resolve({ ok: true, value: this.lastID });
        }
      });
    });
  }

  // Update an existing execution record
  async update(
    id: number, 
    updates: Partial<Pick<Execution, 'completedAt' | 'exitCode' | 'stdout' | 'stderr' | 'status'>>
  ): Promise<Result<Execution>> {
    return new Promise((resolve) => {
      // First, get the existing execution
      this.findById(id).then((findResult) => {
        if (!findResult.ok) {
          resolve(findResult);
          return;
        }

        if (!findResult.value) {
          resolve({ ok: false, error: new Error(`Execution with id ${id} not found`) });
          return;
        }

        const existing = findResult.value;
        const updated: Execution = {
          ...existing,
          ...updates
        };

        const sql = `
          UPDATE executions 
          SET completed_at = ?, exit_code = ?, stdout = ?, stderr = ?, status = ?
          WHERE id = ?
        `;

        const params = [
          updated.completedAt?.toISOString() || null,
          updated.exitCode || null,
          updated.stdout || null,
          updated.stderr || null,
          updated.status,
          id
        ];

        this.db.run(sql, params, function(err) {
          if (err) {
            resolve({ ok: false, error: err });
          } else if (this.changes === 0) {
            resolve({ ok: false, error: new Error(`Execution with id ${id} not found`) });
          } else {
            resolve({ ok: true, value: updated });
          }
        });
      });
    });
  }

  // Find execution by ID
  private async findById(id: number): Promise<Result<Execution | null>> {
    return new Promise((resolve) => {
      const sql = `
        SELECT id, project_id, command, working_dir, started_at, completed_at,
               exit_code, stdout, stderr, status, attempt_number
        FROM executions 
        WHERE id = ?
      `;

      this.db.get(sql, [id], (err, row: any) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else if (!row) {
          resolve({ ok: true, value: null });
        } else {
          const execution = this.mapRowToExecution(row);
          resolve({ ok: true, value: execution });
        }
      });
    });
  }

  // Find all executions for a specific project
  async findByProject(projectId: string): Promise<Result<Execution[]>> {
    return new Promise((resolve) => {
      const sql = `
        SELECT id, project_id, command, working_dir, started_at, completed_at,
               exit_code, stdout, stderr, status, attempt_number
        FROM executions 
        WHERE project_id = ?
        ORDER BY started_at DESC
      `;

      this.db.all(sql, [projectId], (err, rows: any[]) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          const executions = (rows || []).map(row => this.mapRowToExecution(row));
          resolve({ ok: true, value: executions });
        }
      });
    });
  }

  // Find all currently running executions
  async findRunning(): Promise<Result<Execution[]>> {
    return new Promise((resolve) => {
      const sql = `
        SELECT id, project_id, command, working_dir, started_at, completed_at,
               exit_code, stdout, stderr, status, attempt_number
        FROM executions 
        WHERE status = 'running'
        ORDER BY started_at ASC
      `;

      this.db.all(sql, [], (err, rows: any[]) => {
        if (err) {
          resolve({ ok: false, error: err });
        } else {
          const executions = (rows || []).map(row => this.mapRowToExecution(row));
          resolve({ ok: true, value: executions });
        }
      });
    });
  }

  // Helper method to map database row to Execution object
  private mapRowToExecution(row: any): Execution {
    return {
      id: row.id,
      projectId: row.project_id,
      command: row.command,
      workingDir: row.working_dir,
      startedAt: new Date(row.started_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      exitCode: row.exit_code || undefined,
      stdout: row.stdout || undefined,
      stderr: row.stderr || undefined,
      status: row.status as ExecutionStatus,
      attemptNumber: row.attempt_number
    };
  }
}