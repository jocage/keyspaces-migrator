# 📦 keyspaces-migrator

Professional TypeScript library for managing AWS Keyspaces (Apache Cassandra) schema migrations in Node.js applications.

[![npm version](https://badge.fury.io/js/keyspaces-migrator.svg)](https://www.npmjs.com/package/keyspaces-migrator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## ✨ Features

- 🚀 **Professional Migration System** - Apply, rollback, and track schema changes
- 📁 **Multiple File Formats** - Support for `.ts` and `.cql` migration files
- 🔧 **CLI Interface** - Easy-to-use command line tools
- 🏗️ **Type Generation** - Auto-generate TypeScript types from your database schema
- 🌐 **AWS Keyspaces Ready** - Optimized for Amazon Keyspaces with SSL support
- 🔒 **Secure** - Built-in protection against duplicate migrations
- 🧪 **Dry Run Mode** - Preview changes before applying them
- 📊 **CI/CD Friendly** - Perfect for automated deployment pipelines
- 🎯 **TypeScript First** - Full type safety and IntelliSense support

## 📦 Installation

```bash
npm install keyspaces-migrator
# or
yarn add keyspaces-migrator
```

## 🚀 Quick Start

### 1. Environment Configuration

Create a `.env` file in your project root:

```env
# AWS Keyspaces Configuration
KEYSPACE_CONTACT_POINTS=cassandra.us-east-1.amazonaws.com:9142
KEYSPACE_USERNAME=your-username
KEYSPACE_PASSWORD=your-password
KEYSPACE_KEYSPACE=your_keyspace

# Optional: SSL Configuration (recommended for AWS Keyspaces)
KEYSPACE_SSL_ENABLED=true
KEYSPACE_SSL_REJECT_UNAUTHORIZED=false

# Migration Configuration
MIGRATIONS_DIR=./migrations
MIGRATIONS_TABLE=schema_migrations
```

### 2. Create Your First Migration

```bash
npx keyspaces-migrator create create_users_table
```

This creates a new migration file in your migrations directory:

```typescript
// migrations/20241201120000_create_users_table.ts
export const up = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name text,
    email text,
    created_at timestamp,
    updated_at timestamp
  );
`;

export const down = `
  DROP TABLE IF EXISTS users;
`;
```

### 3. Apply Migrations

```bash
# Apply all pending migrations
npx keyspaces-migrator up

# Preview changes without applying (dry run)
npx keyspaces-migrator up --dry-run

# Check migration status
npx keyspaces-migrator status
```

### 4. Generate TypeScript Types

```bash
# Generate types from your database schema
npx keyspaces-migrator generate-types --out schema.ts
```

## 🔧 CLI Commands

### Migration Commands

```bash
# Apply all pending migrations
npx keyspaces-migrator up [--dry-run]

# Rollback the last applied migration
npx keyspaces-migrator down [--dry-run]

# Rollback all applied migrations (use with caution!)
npx keyspaces-migrator reset [--force] [--dry-run]

# Show migration status
npx keyspaces-migrator status

# Create a new migration file
npx keyspaces-migrator create <name> [--cql]
```

### Type Generation

```bash
# Generate TypeScript types
npx keyspaces-migrator generate-types [--out schema.ts] [--no-comments]
```

### Global Options

```bash
-v, --verbose     Enable verbose logging
--dry-run         Preview changes without applying them
```

## 💻 Programmatic Usage

### Basic Usage

```typescript
import { Migrator, ConfigLoader } from 'keyspaces-migrator';

const client = ConfigLoader.createClient();
await client.connect();

const migrator = new Migrator({
  client,
  keyspace: 'my_keyspace',
  migrationsDir: './migrations',
});

// Apply all pending migrations
await migrator.up();

// Check migration status
const status = await migrator.status();
console.log(status);

// Clean up
await migrator.close();
```

### Advanced Configuration

```typescript
import { Client, auth } from 'cassandra-driver';
import { Migrator } from 'keyspaces-migrator';

const client = new Client({
  contactPoints: ['cassandra.us-east-1.amazonaws.com:9142'],
  localDataCenter: 'us-east-1',
  keyspace: 'my_keyspace',
  authProvider: new auth.PlainTextAuthProvider('username', 'password'),
  sslOptions: {
    rejectUnauthorized: false,
  },
});

const migrator = new Migrator({
  client,
  keyspace: 'my_keyspace',
  migrationsDir: './database/migrations',
  migrationsTable: 'custom_migrations_table',
});

await migrator.up();
```

### Type Generation

```typescript
import { TypeGenerator, ConfigLoader } from 'keyspaces-migrator';

const client = ConfigLoader.createClient();
await client.connect();

const generator = new TypeGenerator({
  client,
  keyspace: 'my_keyspace',
  outputFile: './types/database.ts',
  includeComments: true,
});

await generator.generateTypes();
```

## 📁 Project Structure

```
your-project/
├── migrations/
│   ├── 20241201120000_create_users.ts
│   ├── 20241201130000_add_email_index.ts
│   └── 20241201140000_create_posts.cql
├── .env
├── package.json
└── schema.ts (generated)
```

## 📝 Migration File Formats

### TypeScript Format (.ts)

```typescript
/**
 * Migration: Create users table
 * Created: 2024-12-01T12:00:00.000Z
 */

export const up = `
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    name text,
    email text,
    created_at timestamp
  );
  
  CREATE INDEX IF NOT EXISTS users_email_idx ON users (email);
`;

export const down = `
  DROP INDEX IF EXISTS users_email_idx;
  DROP TABLE IF EXISTS users;
`;
```

### CQL Format (.cql)

```sql
-- Migration: Create posts table
-- Created: 2024-12-01T12:00:00.000Z

-- +migrate Up
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY,
  title text,
  content text,
  author_id UUID,
  created_at timestamp
);

-- +migrate Down
DROP TABLE IF EXISTS posts;
```

## 🏗️ Generated TypeScript Types

The `generate-types` command creates comprehensive TypeScript interfaces:

```typescript
/**
 * Auto-generated TypeScript types for AWS Keyspaces
 * Keyspace: my_keyspace
 * Generated: 2024-12-01T12:00:00.000Z
 */

export interface Users {
  id: CassandraUUID; // Partition Key
  name?: string;
  email?: string;
  created_at?: CassandraTimestamp;
}

export interface Posts {
  id: CassandraUUID; // Partition Key
  title?: string;
  content?: string;
  author_id?: CassandraUUID;
  created_at?: CassandraTimestamp;
}

export type TableName = 'users' | 'posts';

export type TableTypeMap = {
  users: Users;
  posts: Posts;
};
```

## 🔐 AWS Keyspaces Configuration

### Authentication Methods

#### 1. Username/Password (Service-Specific Credentials)

```env
KEYSPACE_CONTACT_POINTS=cassandra.us-east-1.amazonaws.com:9142
KEYSPACE_USERNAME=your-service-username
KEYSPACE_PASSWORD=your-service-password
KEYSPACE_SSL_ENABLED=true
```

#### 2. Secure Connect Bundle (DataStax Astra)

```env
KEYSPACE_SECURE_CONNECT_BUNDLE=/path/to/secure-connect-bundle.zip
KEYSPACE_USERNAME=your-username
KEYSPACE_PASSWORD=your-password
```

### SSL Configuration

For AWS Keyspaces, SSL is required:

```env
KEYSPACE_SSL_ENABLED=true
KEYSPACE_SSL_REJECT_UNAUTHORIZED=false
```

## 🚨 CI/CD Integration

### GitHub Actions Example

```yaml
name: Database Migration
on:
  push:
    branches: [main]

jobs:
  migrate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run migrations
        run: npx keyspaces-migrator up
        env:
          KEYSPACE_CONTACT_POINTS: ${{ secrets.KEYSPACE_CONTACT_POINTS }}
          KEYSPACE_USERNAME: ${{ secrets.KEYSPACE_USERNAME }}
          KEYSPACE_PASSWORD: ${{ secrets.KEYSPACE_PASSWORD }}
          KEYSPACE_KEYSPACE: ${{ secrets.KEYSPACE_KEYSPACE }}
```

### Docker Example

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["npx", "keyspaces-migrator", "up"]
```

## ⚠️ Important Considerations

### Down Migrations Warning

**⚠️ CAUTION**: Down migrations can be destructive and may result in data loss. Always:

- Test down migrations in a development environment first
- Backup your data before running down migrations in production
- Consider the impact on dependent applications
- Use `--dry-run` to preview changes before applying

### Best Practices

1. **Always backup before migrations** in production environments
2. **Test migrations** in development/staging first
3. **Use descriptive names** for migration files
4. **Keep migrations atomic** - one logical change per migration
5. **Avoid modifying existing migrations** once they're applied
6. **Use `--dry-run`** to preview changes
7. **Monitor migration execution** in production

## 🛠️ Development

### Building the Project

```bash
git clone https://github.com/yourusername/keyspaces-migrator.git
cd keyspaces-migrator
npm install
npm run build
```

### Running Tests

```bash
npm test
npm run test:watch
npm run test:coverage
```

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🐛 Troubleshooting

### Common Issues

#### Connection Timeout

```
Error: Connection timeout
```

**Solution**: Increase timeout values in your configuration:

```typescript
const client = new Client({
  socketOptions: {
    connectTimeout: 20000,
    readTimeout: 20000,
  },
});
```

#### SSL Certificate Issues

```
Error: SSL certificate verification failed
```

**Solution**: Set `KEYSPACE_SSL_REJECT_UNAUTHORIZED=false` for AWS Keyspaces.

#### Migration Already Applied

```
Error: Migration xxx has already been applied
```

**Solution**: Check migration status with `npx keyspaces-migrator status` and ensure you're not trying to apply the same migration twice.

### Debug Mode

Enable verbose logging for troubleshooting:

```bash
npx keyspaces-migrator up --verbose
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

- 📖 [Documentation](https://github.com/yourusername/keyspaces-migrator)
- 🐛 [Issue Tracker](https://github.com/yourusername/keyspaces-migrator/issues)
- 💬 [Discussions](https://github.com/yourusername/keyspaces-migrator/discussions)

## 🙏 Acknowledgments

- Built with [cassandra-driver](https://github.com/datastax/nodejs-driver) for robust Cassandra connectivity
- Inspired by database migration tools like Flyway and Liquibase
- Designed specifically for AWS Keyspaces and Apache Cassandra

---

Made with ❤️ for the Node.js and AWS Keyspaces community
