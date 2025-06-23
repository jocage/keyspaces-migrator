/**
 * Migration: Create users table
 * Created: 2024-01-01T00:00:00.000Z
 */

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
