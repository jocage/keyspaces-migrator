// Mock Logger first
const mockLogger = {
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  setVerbose: jest.fn(),
  table: jest.fn(),
} as any;

// Mock dependencies
jest.mock('cassandra-driver');
jest.mock('../src/fs');
jest.mock('../src/logger', () => ({
  Logger: {
    getInstance: jest.fn(() => mockLogger),
  },
}));

import { Client } from 'cassandra-driver';
import { FileSystemManager } from '../src/fs';
import { Logger } from '../src/logger';
import { Migrator } from '../src/migrator';

const mockClient = {
  execute: jest.fn(),
  shutdown: jest.fn(),
} as unknown as Client;

const mockFileSystemManager = FileSystemManager as jest.Mocked<
  typeof FileSystemManager
>;

describe('Migrator', () => {
  let migrator: Migrator;

  beforeEach(() => {
    jest.clearAllMocks();

    migrator = new Migrator({
      client: mockClient,
      keyspace: 'test_keyspace',
      migrationsDir: './test/migrations',
      migrationsTable: 'test_migrations',
    });
  });

  describe('up()', () => {
    it('should apply pending migrations', async () => {
      const mockMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: 'CREATE TABLE users (id UUID PRIMARY KEY);',
          down: 'DROP TABLE users;',
        },
        {
          id: '002',
          filename: '002_add_email_index.ts',
          up: 'CREATE INDEX ON users (email);',
          down: 'DROP INDEX users_email_idx;',
        },
      ];

      const mockAppliedMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: '',
          down: '',
          appliedAt: new Date(),
        },
      ];

      mockFileSystemManager.loadMigrations.mockResolvedValue(mockMigrations);

      // Mock database calls
      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: mockAppliedMigrations }) // Get applied migrations
        .mockResolvedValueOnce({}) // Execute migration
        .mockResolvedValueOnce({}); // Record migration

      await migrator.up();

      expect(mockClient.execute).toHaveBeenCalledWith(
        'CREATE INDEX ON users (email)'
      );
      expect(mockLogger.success).toHaveBeenCalledWith(
        'Successfully applied 1 migration(s)'
      );
    });

    it('should handle no pending migrations', async () => {
      const mockMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: 'CREATE TABLE users (id UUID PRIMARY KEY);',
          down: 'DROP TABLE users;',
        },
      ];

      const mockAppliedMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: '',
          down: '',
          appliedAt: new Date(),
        },
      ];

      mockFileSystemManager.loadMigrations.mockResolvedValue(mockMigrations);

      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: mockAppliedMigrations }); // Get applied migrations

      await migrator.up();

      expect(mockLogger.success).toHaveBeenCalledWith(
        'No pending migrations found'
      );
    });

    it('should handle dry run mode', async () => {
      const mockMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: 'CREATE TABLE users (id UUID PRIMARY KEY);',
          down: 'DROP TABLE users;',
        },
      ];

      mockFileSystemManager.loadMigrations.mockResolvedValue(mockMigrations);

      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: [] }); // Get applied migrations

      await migrator.up(true);

      expect(mockLogger.info).toHaveBeenCalledWith(
        '[DRY RUN] Would execute: CREATE TABLE users (id UUID PRIMARY KEY)'
      );
    });

    it('should handle migration execution errors', async () => {
      const mockMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: 'INVALID SQL;',
          down: 'DROP TABLE users;',
        },
      ];

      mockFileSystemManager.loadMigrations.mockResolvedValue(mockMigrations);

      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: [] }) // Get applied migrations
        .mockRejectedValueOnce(new Error('SQL syntax error')); // Execute migration fails

      await expect(migrator.up()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('down()', () => {
    it('should rollback the last applied migration', async () => {
      const mockMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: 'CREATE TABLE users (id UUID PRIMARY KEY);',
          down: 'DROP TABLE users;',
        },
      ];

      const mockAppliedMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: '',
          down: '',
          appliedAt: new Date(),
        },
      ];

      mockFileSystemManager.loadMigrations.mockResolvedValue(mockMigrations);

      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: mockAppliedMigrations }) // Get applied migrations
        .mockResolvedValueOnce({}) // Execute down migration
        .mockResolvedValueOnce({}); // Remove migration record

      await migrator.down();

      expect(mockClient.execute).toHaveBeenCalledWith('DROP TABLE users');
      expect(mockLogger.success).toHaveBeenCalledWith(
        'Rolled back migration: 001_create_users.ts'
      );
    });

    it('should handle no applied migrations', async () => {
      mockFileSystemManager.loadMigrations.mockResolvedValue([]);

      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: [] }); // Get applied migrations

      await migrator.down();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No applied migrations found'
      );
    });

    it('should handle missing migration file', async () => {
      const mockAppliedMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: '',
          down: '',
          appliedAt: new Date(),
        },
      ];

      mockFileSystemManager.loadMigrations.mockResolvedValue([]); // No migration files

      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: mockAppliedMigrations }); // Get applied migrations

      await expect(migrator.down()).rejects.toThrow('Migration file not found');
    });
  });

  describe('reset()', () => {
    it('should rollback all applied migrations', async () => {
      const mockMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: 'CREATE TABLE users (id UUID PRIMARY KEY);',
          down: 'DROP TABLE users;',
        },
        {
          id: '002',
          filename: '002_add_email_index.ts',
          up: 'CREATE INDEX ON users (email);',
          down: 'DROP INDEX users_email_idx;',
        },
      ];

      const mockAppliedMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: '',
          down: '',
          appliedAt: new Date(2024, 0, 1),
        },
        {
          id: '002',
          filename: '002_add_email_index.ts',
          up: '',
          down: '',
          appliedAt: new Date(2024, 0, 2),
        },
      ];

      mockFileSystemManager.loadMigrations.mockResolvedValue(mockMigrations);

      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: mockAppliedMigrations }) // Get applied migrations
        .mockResolvedValue({}); // All subsequent calls succeed

      await migrator.reset();

      expect(mockLogger.success).toHaveBeenCalledWith(
        'Successfully rolled back 2 migration(s)'
      );
    });

    it('should handle no applied migrations', async () => {
      mockFileSystemManager.loadMigrations.mockResolvedValue([]);

      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: [] }); // Get applied migrations

      await migrator.reset();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No applied migrations found'
      );
    });
  });

  describe('status()', () => {
    it('should return migration status', async () => {
      const mockMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: 'CREATE TABLE users (id UUID PRIMARY KEY);',
          down: 'DROP TABLE users;',
        },
        {
          id: '002',
          filename: '002_add_email_index.ts',
          up: 'CREATE INDEX ON users (email);',
          down: 'DROP INDEX users_email_idx;',
        },
      ];

      const mockAppliedMigrations = [
        {
          id: '001',
          filename: '001_create_users.ts',
          up: '',
          down: '',
          appliedAt: new Date(),
        },
      ];

      mockFileSystemManager.loadMigrations.mockResolvedValue(mockMigrations);

      (mockClient.execute as jest.Mock)
        .mockResolvedValueOnce({ rows: [] }) // Initialize migrations table
        .mockResolvedValueOnce({ rows: mockAppliedMigrations }); // Get applied migrations

      const status = await migrator.status();

      expect(status).toHaveLength(2);
      expect(status[0].status).toBe('applied');
      expect(status[1].status).toBe('pending');
    });
  });

  describe('close()', () => {
    it('should close the database connection', async () => {
      await migrator.close();
      expect(mockClient.shutdown).toHaveBeenCalled();
    });
  });
});
