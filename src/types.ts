import { Client } from 'cassandra-driver';

export interface MigrationConfig {
  client: Client;
  keyspace: string;
  migrationsDir?: string;
  migrationsTable?: string;
}

export interface Migration {
  id: string;
  filename: string;
  up: string;
  down: string;
  appliedAt?: Date;
}

export interface MigrationFile {
  up: string;
  down: string;
}

export interface MigrationStatus {
  id: string;
  filename: string;
  status: 'applied' | 'pending';
  appliedAt?: Date;
}

export interface DatabaseConfig {
  contactPoints: string[];
  username?: string;
  password?: string;
  keyspace: string;
  secureConnectBundle?: string;
  ssl?: {
    enabled: boolean;
    rejectUnauthorized: boolean;
  };
}

export interface TypeGenerationConfig {
  client: Client;
  keyspace: string;
  outputFile: string;
  includeComments?: boolean;
}

export interface TableColumn {
  columnName: string;
  type: string;
  kind: 'partition_key' | 'clustering' | 'regular' | 'static';
  position?: number;
}

export interface TableSchema {
  keyspaceName: string;
  tableName: string;
  columns: TableColumn[];
}
