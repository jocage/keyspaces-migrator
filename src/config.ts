import { Client, auth } from 'cassandra-driver';
import { config } from 'dotenv';
import { Logger } from './logger';
import { DatabaseConfig } from './types';

config(); // Load .env file

const logger = Logger.getInstance();

export class ConfigLoader {
  static loadDatabaseConfig(): DatabaseConfig {
    const contactPoints = process.env.KEYSPACE_CONTACT_POINTS?.split(',') || [
      '127.0.0.1:9042',
    ];
    const username = process.env.KEYSPACE_USERNAME;
    const password = process.env.KEYSPACE_PASSWORD;
    const keyspace = process.env.KEYSPACE_KEYSPACE;
    const secureConnectBundle = process.env.KEYSPACE_SECURE_CONNECT_BUNDLE;
    const sslEnabled = process.env.KEYSPACE_SSL_ENABLED === 'true';
    const sslRejectUnauthorized =
      process.env.KEYSPACE_SSL_REJECT_UNAUTHORIZED !== 'false';

    if (!keyspace) {
      throw new Error('KEYSPACE_KEYSPACE environment variable is required');
    }

    return {
      contactPoints,
      username,
      password,
      keyspace,
      secureConnectBundle,
      ssl: {
        enabled: sslEnabled,
        rejectUnauthorized: sslRejectUnauthorized,
      },
    };
  }

  static createClient(config?: Partial<DatabaseConfig>): Client {
    const dbConfig = { ...this.loadDatabaseConfig(), ...config };

    logger.debug(`Connecting to keyspace: ${dbConfig.keyspace}`);
    logger.debug(`Contact points: ${dbConfig.contactPoints.join(', ')}`);

    const clientOptions: any = {
      contactPoints: dbConfig.contactPoints,
      localDataCenter: 'us-east-1', // Default for AWS Keyspaces
      keyspace: dbConfig.keyspace,
    };

    // Authentication
    if (dbConfig.username && dbConfig.password) {
      clientOptions.authProvider = new auth.PlainTextAuthProvider(
        dbConfig.username,
        dbConfig.password
      );
    }

    // Secure Connect Bundle (for DataStax Astra)
    if (dbConfig.secureConnectBundle) {
      clientOptions.cloud = {
        secureConnectBundle: dbConfig.secureConnectBundle,
      };
    }

    // SSL Configuration
    if (dbConfig.ssl?.enabled) {
      clientOptions.sslOptions = {
        rejectUnauthorized: dbConfig.ssl.rejectUnauthorized,
      };
    }

    // AWS Keyspaces specific settings
    if (dbConfig.contactPoints.some(cp => cp.includes('amazonaws.com'))) {
      clientOptions.protocolOptions = {
        port: 9142,
      };
      clientOptions.socketOptions = {
        connectTimeout: 20000,
        readTimeout: 20000,
      };
    }

    return new Client(clientOptions);
  }

  static getMigrationsDir(): string {
    return process.env.MIGRATIONS_DIR || './migrations';
  }

  static getMigrationsTable(): string {
    return process.env.MIGRATIONS_TABLE || 'schema_migrations';
  }
}
