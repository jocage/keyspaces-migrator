#!/usr/bin/env node

import { Command } from 'commander';
import ora from 'ora';
import { ConfigLoader } from './config';
import { FileSystemManager } from './fs';
import { Logger } from './logger';
import { Migrator } from './migrator';
import { TypeGenerator } from './typegen';

const logger = Logger.getInstance();
const program = new Command();

program
  .name('keyspaces-migrator')
  .description(
    'Professional TypeScript library for managing AWS Keyspaces (Cassandra) schema migrations'
  )
  .version('1.0.0');

// Global options
program
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--dry-run', 'Show what would be executed without making changes')
  .hook('preAction', thisCommand => {
    const opts = thisCommand.opts();
    if (opts.verbose) {
      logger.setVerbose(true);
    }
  });

// Up command - Apply all pending migrations
program
  .command('up')
  .description('Apply all pending migrations')
  .option('--dry-run', 'Show what would be executed without making changes')
  .action(async options => {
    const spinner = ora('Connecting to database...').start();
    let client;

    try {
      client = ConfigLoader.createClient();
      await client.connect();
      spinner.succeed('Connected to database');

      const migrator = new Migrator({
        client,
        keyspace: ConfigLoader.loadDatabaseConfig().keyspace,
        migrationsDir: ConfigLoader.getMigrationsDir(),
        migrationsTable: ConfigLoader.getMigrationsTable(),
      });

      await migrator.up(options.dryRun || program.opts().dryRun);
    } catch (error) {
      spinner.fail('Migration failed');
      logger.error(`Error: ${error}`);
      process.exit(1);
    } finally {
      if (client) {
        await client.shutdown();
      }
    }
  });

// Down command - Rollback last migration
program
  .command('down')
  .description('Rollback the last applied migration')
  .option('--dry-run', 'Show what would be executed without making changes')
  .action(async options => {
    const spinner = ora('Connecting to database...').start();
    let client;

    try {
      client = ConfigLoader.createClient();
      await client.connect();
      spinner.succeed('Connected to database');

      const migrator = new Migrator({
        client,
        keyspace: ConfigLoader.loadDatabaseConfig().keyspace,
        migrationsDir: ConfigLoader.getMigrationsDir(),
        migrationsTable: ConfigLoader.getMigrationsTable(),
      });

      await migrator.down(options.dryRun || program.opts().dryRun);
    } catch (error) {
      spinner.fail('Migration rollback failed');
      logger.error(`Error: ${error}`);
      process.exit(1);
    } finally {
      if (client) {
        await client.shutdown();
      }
    }
  });

// Reset command - Rollback all migrations
program
  .command('reset')
  .description('Rollback all applied migrations')
  .option('--dry-run', 'Show what would be executed without making changes')
  .option('--force', 'Skip confirmation prompt')
  .action(async options => {
    if (!options.force && !options.dryRun && !program.opts().dryRun) {
      logger.warn('This will rollback ALL applied migrations!');

      // Simple confirmation without external dependencies
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const confirmed = await new Promise<boolean>(resolve => {
        rl.question(
          'Are you sure you want to continue? (y/N): ',
          (answer: string) => {
            rl.close();
            resolve(
              answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes'
            );
          }
        );
      });

      if (!confirmed) {
        logger.info('Reset cancelled');
        return;
      }
    }

    const spinner = ora('Connecting to database...').start();
    let client;

    try {
      client = ConfigLoader.createClient();
      await client.connect();
      spinner.succeed('Connected to database');

      const migrator = new Migrator({
        client,
        keyspace: ConfigLoader.loadDatabaseConfig().keyspace,
        migrationsDir: ConfigLoader.getMigrationsDir(),
        migrationsTable: ConfigLoader.getMigrationsTable(),
      });

      await migrator.reset(options.dryRun || program.opts().dryRun);
    } catch (error) {
      spinner.fail('Migration reset failed');
      logger.error(`Error: ${error}`);
      process.exit(1);
    } finally {
      if (client) {
        await client.shutdown();
      }
    }
  });

// Status command - Show migration status
program
  .command('status')
  .description('Show status of all migrations')
  .action(async () => {
    const spinner = ora('Connecting to database...').start();
    let client;

    try {
      client = ConfigLoader.createClient();
      await client.connect();
      spinner.succeed('Connected to database');

      const migrator = new Migrator({
        client,
        keyspace: ConfigLoader.loadDatabaseConfig().keyspace,
        migrationsDir: ConfigLoader.getMigrationsDir(),
        migrationsTable: ConfigLoader.getMigrationsTable(),
      });

      const status = await migrator.status();

      if (status.length === 0) {
        logger.info('No migrations found');
        return;
      }

      logger.info('Migration Status:');
      logger.table(
        status.map(s => ({
          ID: s.id,
          Filename: s.filename,
          Status: s.status,
          'Applied At': s.appliedAt ? s.appliedAt.toISOString() : '-',
        }))
      );
    } catch (error) {
      spinner.fail('Failed to get migration status');
      logger.error(`Error: ${error}`);
      process.exit(1);
    } finally {
      if (client) {
        await client.shutdown();
      }
    }
  });

// Create command - Create new migration
program
  .command('create <name>')
  .description('Create a new migration file')
  .option('--cql', 'Create a CQL migration file instead of TypeScript')
  .action((name, options) => {
    try {
      const migrationsDir = ConfigLoader.getMigrationsDir();

      let filePath: string;
      if (options.cql) {
        filePath = FileSystemManager.createCQLMigration(migrationsDir, name);
      } else {
        filePath = FileSystemManager.createMigration(migrationsDir, name);
      }

      logger.success(`Created migration: ${filePath}`);
    } catch (error) {
      logger.error(`Failed to create migration: ${error}`);
      process.exit(1);
    }
  });

// Generate types command
program
  .command('generate-types')
  .description('Generate TypeScript types from database schema')
  .option('-o, --out <file>', 'Output file path', 'schema.ts')
  .option('--no-comments', 'Exclude comments from generated types')
  .action(async options => {
    const spinner = ora('Connecting to database...').start();
    let client;

    try {
      client = ConfigLoader.createClient();
      await client.connect();
      spinner.succeed('Connected to database');

      const generator = new TypeGenerator({
        client,
        keyspace: ConfigLoader.loadDatabaseConfig().keyspace,
        outputFile: options.out,
        includeComments: options.comments,
      });

      await generator.generateTypes();
    } catch (error) {
      spinner.fail('Type generation failed');
      logger.error(`Error: ${error}`);
      process.exit(1);
    } finally {
      if (client) {
        await client.shutdown();
      }
    }
  });

// Error handling
program.exitOverride();

try {
  program.parse();
} catch (error: any) {
  if (error.code !== 'commander.help' && error.code !== 'commander.version') {
    logger.error(`CLI Error: ${error.message}`);
    process.exit(1);
  }
}
