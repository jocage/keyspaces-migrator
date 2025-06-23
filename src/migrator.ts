import { Client } from 'cassandra-driver';
import { FileSystemManager } from './fs';
import { Logger } from './logger';
import { Migration, MigrationConfig, MigrationStatus } from './types';

const logger = Logger.getInstance();

export class Migrator {
  private client: Client;
  private keyspace: string;
  private migrationsDir: string;
  private migrationsTable: string;

  constructor(config: MigrationConfig) {
    this.client = config.client;
    this.keyspace = config.keyspace;
    this.migrationsDir = config.migrationsDir || './migrations';
    this.migrationsTable = config.migrationsTable || 'schema_migrations';
  }

  /**
   * Initialize the migrations table
   */
  private async initializeMigrationsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${this.keyspace}.${this.migrationsTable} (
        id text PRIMARY KEY,
        filename text,
        applied_at timestamp,
        checksum text
      )
    `;

    try {
      await this.client.execute(createTableQuery);
      logger.debug(`Migrations table ${this.migrationsTable} initialized`);
    } catch (error) {
      throw new Error(`Failed to initialize migrations table: ${error}`);
    }
  }

  /**
   * Get list of applied migrations from database
   */
  private async getAppliedMigrations(): Promise<Migration[]> {
    await this.initializeMigrationsTable();

    const query = `SELECT id, filename, applied_at FROM ${this.keyspace}.${this.migrationsTable}`;

    try {
      const result = await this.client.execute(query);
      return result.rows.map(row => ({
        id: row.id,
        filename: row.filename,
        up: '',
        down: '',
        appliedAt: row.applied_at,
      }));
    } catch (error) {
      throw new Error(`Failed to get applied migrations: ${error}`);
    }
  }

  /**
   * Record a migration as applied
   */
  private async recordMigration(migration: Migration): Promise<void> {
    const query = `
      INSERT INTO ${this.keyspace}.${this.migrationsTable} (id, filename, applied_at, checksum)
      VALUES (?, ?, ?, ?)
    `;

    const checksum = this.calculateChecksum(migration.up);
    const params = [migration.id, migration.filename, new Date(), checksum];

    try {
      await this.client.execute(query, params);
      logger.debug(`Recorded migration: ${migration.filename}`);
    } catch (error) {
      throw new Error(
        `Failed to record migration ${migration.filename}: ${error}`
      );
    }
  }

  /**
   * Remove a migration record
   */
  private async removeMigrationRecord(migrationId: string): Promise<void> {
    const query = `DELETE FROM ${this.keyspace}.${this.migrationsTable} WHERE id = ?`;

    try {
      await this.client.execute(query, [migrationId]);
      logger.debug(`Removed migration record: ${migrationId}`);
    } catch (error) {
      throw new Error(
        `Failed to remove migration record ${migrationId}: ${error}`
      );
    }
  }

  /**
   * Calculate checksum for migration content
   */
  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * Execute CQL statements
   */
  private async executeCQL(
    cql: string,
    dryRun: boolean = false
  ): Promise<void> {
    const statements = cql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    for (const statement of statements) {
      if (dryRun) {
        logger.info(`[DRY RUN] Would execute: ${statement}`);
      } else {
        try {
          await this.client.execute(statement);
          logger.debug(`Executed: ${statement.substring(0, 50)}...`);
        } catch (error) {
          throw new Error(
            `Failed to execute CQL: ${statement}\nError: ${error}`
          );
        }
      }
    }
  }

  /**
   * Apply all pending migrations
   */
  async up(dryRun: boolean = false): Promise<void> {
    logger.info('Starting migration up...');

    const [fileMigrations, appliedMigrations] = await Promise.all([
      FileSystemManager.loadMigrations(this.migrationsDir),
      this.getAppliedMigrations(),
    ]);

    const appliedIds = new Set(appliedMigrations.map(m => m.id));
    const pendingMigrations = fileMigrations.filter(m => !appliedIds.has(m.id));

    if (pendingMigrations.length === 0) {
      logger.success('No pending migrations found');
      return;
    }

    logger.info(`Found ${pendingMigrations.length} pending migration(s)`);

    for (const migration of pendingMigrations) {
      try {
        logger.info(`Applying migration: ${migration.filename}`);

        await this.executeCQL(migration.up, dryRun);

        if (!dryRun) {
          await this.recordMigration(migration);
        }

        logger.success(`Applied migration: ${migration.filename}`);
      } catch (error) {
        logger.error(
          `Failed to apply migration ${migration.filename}: ${error}`
        );
        throw error;
      }
    }

    logger.success(
      `Successfully applied ${pendingMigrations.length} migration(s)`
    );
  }

  /**
   * Rollback the last applied migration
   */
  async down(dryRun: boolean = false): Promise<void> {
    logger.info('Starting migration down...');

    const [fileMigrations, appliedMigrations] = await Promise.all([
      FileSystemManager.loadMigrations(this.migrationsDir),
      this.getAppliedMigrations(),
    ]);

    if (appliedMigrations.length === 0) {
      logger.warn('No applied migrations found');
      return;
    }

    // Get the last applied migration
    const lastApplied = appliedMigrations.sort(
      (a, b) => (b.appliedAt?.getTime() || 0) - (a.appliedAt?.getTime() || 0)
    )[0];

    const migrationToRollback = fileMigrations.find(
      m => m.id === lastApplied.id
    );

    if (!migrationToRollback) {
      throw new Error(
        `Migration file not found for applied migration: ${lastApplied.filename}`
      );
    }

    try {
      logger.info(`Rolling back migration: ${migrationToRollback.filename}`);

      await this.executeCQL(migrationToRollback.down, dryRun);

      if (!dryRun) {
        await this.removeMigrationRecord(migrationToRollback.id);
      }

      logger.success(`Rolled back migration: ${migrationToRollback.filename}`);
    } catch (error) {
      logger.error(
        `Failed to rollback migration ${migrationToRollback.filename}: ${error}`
      );
      throw error;
    }
  }

  /**
   * Rollback all applied migrations
   */
  async reset(dryRun: boolean = false): Promise<void> {
    logger.info('Starting migration reset...');

    const [fileMigrations, appliedMigrations] = await Promise.all([
      FileSystemManager.loadMigrations(this.migrationsDir),
      this.getAppliedMigrations(),
    ]);

    if (appliedMigrations.length === 0) {
      logger.warn('No applied migrations found');
      return;
    }

    // Sort applied migrations by applied_at descending (newest first)
    const sortedApplied = appliedMigrations.sort(
      (a, b) => (b.appliedAt?.getTime() || 0) - (a.appliedAt?.getTime() || 0)
    );

    logger.info(
      `Found ${sortedApplied.length} applied migration(s) to rollback`
    );

    for (const appliedMigration of sortedApplied) {
      const migrationToRollback = fileMigrations.find(
        m => m.id === appliedMigration.id
      );

      if (!migrationToRollback) {
        logger.warn(
          `Migration file not found for applied migration: ${appliedMigration.filename}`
        );
        continue;
      }

      try {
        logger.info(`Rolling back migration: ${migrationToRollback.filename}`);

        await this.executeCQL(migrationToRollback.down, dryRun);

        if (!dryRun) {
          await this.removeMigrationRecord(migrationToRollback.id);
        }

        logger.success(
          `Rolled back migration: ${migrationToRollback.filename}`
        );
      } catch (error) {
        logger.error(
          `Failed to rollback migration ${migrationToRollback.filename}: ${error}`
        );
        throw error;
      }
    }

    logger.success(
      `Successfully rolled back ${sortedApplied.length} migration(s)`
    );
  }

  /**
   * Get migration status
   */
  async status(): Promise<MigrationStatus[]> {
    const [fileMigrations, appliedMigrations] = await Promise.all([
      FileSystemManager.loadMigrations(this.migrationsDir),
      this.getAppliedMigrations(),
    ]);

    const appliedMap = new Map(appliedMigrations.map(m => [m.id, m]));

    return fileMigrations.map(migration => ({
      id: migration.id,
      filename: migration.filename,
      status: appliedMap.has(migration.id) ? 'applied' : 'pending',
      appliedAt: appliedMap.get(migration.id)?.appliedAt,
    }));
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    await this.client.shutdown();
  }
}
