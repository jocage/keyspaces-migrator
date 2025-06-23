import * as fs from 'fs';
import * as path from 'path';
import { Logger } from './logger';
import { Migration, MigrationFile } from './types';

const logger = Logger.getInstance();

export class FileSystemManager {
  static async loadMigrations(migrationsDir: string): Promise<Migration[]> {
    const migrations: Migration[] = [];

    if (!fs.existsSync(migrationsDir)) {
      logger.warn(`Migrations directory does not exist: ${migrationsDir}`);
      return migrations;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter(file => file.endsWith('.ts') || file.endsWith('.cql'))
      .sort();

    for (const filename of files) {
      const filePath = path.join(migrationsDir, filename);
      const id = this.extractMigrationId(filename);

      try {
        const migration = await this.loadMigrationFile(filePath, id, filename);
        migrations.push(migration);
      } catch (error) {
        logger.error(`Failed to load migration ${filename}: ${error}`);
        throw error;
      }
    }

    return migrations;
  }

  private static extractMigrationId(filename: string): string {
    const match = filename.match(/^(\d+)/);
    if (!match) {
      throw new Error(
        `Invalid migration filename format: ${filename}. Expected format: 001_migration_name.ts`
      );
    }
    return match[1];
  }

  private static async loadMigrationFile(
    filePath: string,
    id: string,
    filename: string
  ): Promise<Migration> {
    const ext = path.extname(filePath);

    if (ext === '.ts') {
      return this.loadTypeScriptMigration(filePath, id, filename);
    } else if (ext === '.cql') {
      return this.loadCQLMigration(filePath, id, filename);
    } else {
      throw new Error(`Unsupported migration file extension: ${ext}`);
    }
  }

  private static async loadTypeScriptMigration(
    filePath: string,
    id: string,
    filename: string
  ): Promise<Migration> {
    try {
      // Dynamic import for TypeScript files
      const migrationModule = await import(path.resolve(filePath));

      if (!migrationModule.up || !migrationModule.down) {
        throw new Error(
          `Migration ${filename} must export 'up' and 'down' functions`
        );
      }

      return {
        id,
        filename,
        up: migrationModule.up,
        down: migrationModule.down,
      };
    } catch (error) {
      throw new Error(
        `Failed to load TypeScript migration ${filename}: ${error}`
      );
    }
  }

  private static loadCQLMigration(
    filePath: string,
    id: string,
    filename: string
  ): Migration {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const sections = this.parseCQLFile(content);

      return {
        id,
        filename,
        up: sections.up,
        down: sections.down,
      };
    } catch (error) {
      throw new Error(`Failed to load CQL migration ${filename}: ${error}`);
    }
  }

  private static parseCQLFile(content: string): { up: string; down: string } {
    const lines = content.split('\n');
    let currentSection: 'up' | 'down' | null = null;
    const sections = { up: '', down: '' };

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('-- +migrate Up')) {
        currentSection = 'up';
        continue;
      }

      if (trimmed.startsWith('-- +migrate Down')) {
        currentSection = 'down';
        continue;
      }

      if (currentSection && !trimmed.startsWith('--')) {
        sections[currentSection] += line + '\n';
      }
    }

    if (!sections.up.trim()) {
      throw new Error('CQL migration must contain "-- +migrate Up" section');
    }

    if (!sections.down.trim()) {
      throw new Error('CQL migration must contain "-- +migrate Down" section');
    }

    return sections;
  }

  static createMigration(migrationsDir: string, name: string): string {
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const timestamp = this.generateTimestamp();
    const filename = `${timestamp}_${name
      .replace(/\s+/g, '_')
      .toLowerCase()}.ts`;
    const filePath = path.join(migrationsDir, filename);

    const template = this.getMigrationTemplate(name);
    fs.writeFileSync(filePath, template);

    return filePath;
  }

  private static generateTimestamp(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const second = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hour}${minute}${second}`;
  }

  private static getMigrationTemplate(name: string): string {
    return `/**
 * Migration: ${name}
 * Created: ${new Date().toISOString()}
 */

export const up = \`
  -- Add your up migration SQL here
  -- Example:
  -- CREATE TABLE IF NOT EXISTS example_table (
  --   id UUID PRIMARY KEY,
  --   name text,
  --   created_at timestamp
  -- );
\`;

export const down = \`
  -- Add your down migration SQL here
  -- Example:
  -- DROP TABLE IF EXISTS example_table;
\`;
`;
  }

  static createCQLMigration(migrationsDir: string, name: string): string {
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const timestamp = this.generateTimestamp();
    const filename = `${timestamp}_${name
      .replace(/\s+/g, '_')
      .toLowerCase()}.cql`;
    const filePath = path.join(migrationsDir, filename);

    const template = this.getCQLMigrationTemplate(name);
    fs.writeFileSync(filePath, template);

    return filePath;
  }

  private static getCQLMigrationTemplate(name: string): string {
    return `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- +migrate Up
-- Add your up migration CQL here
-- Example:
-- CREATE TABLE IF NOT EXISTS example_table (
--   id UUID PRIMARY KEY,
--   name text,
--   created_at timestamp
-- );

-- +migrate Down
-- Add your down migration CQL here
-- Example:
-- DROP TABLE IF EXISTS example_table;
`;
  }
}
