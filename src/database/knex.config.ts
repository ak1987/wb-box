import { Knex } from 'knex';

export const knexConfig: Knex.Config = {
  client: 'pg',
  connection: {
    host: process.env.PG_HOST || 'postgres',
    port: parseInt(process.env.PG_PORT || '5432'),
    database: process.env.PG_DB || 'db',
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASS || 'postgres',
  },
  migrations: {
    directory: './src/database/migrations',
    extension: 'ts',
  },
  pool: {
    min: 2,
    max: 10,
  },
};

