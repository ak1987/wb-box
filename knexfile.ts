import type { Knex } from 'knex';

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST || 'localhost',
      port: parseInt(process.env.PG_PORT || '5432'),
      database: process.env.PG_DB || 'db',
      user: process.env.PG_USER || 'postgres',
      password: process.env.PG_PASS || 'postgres',
    },
    migrations: {
      directory: './src/database/migrations',
      extension: 'ts',
    },
    seeds: {
      directory: './src/database/seeds',
    },
  },
  production: {
    client: 'pg',
    connection: {
      host: process.env.PG_HOST,
      port: parseInt(process.env.PG_PORT || '5432'),
      database: process.env.PG_DB,
      user: process.env.PG_USER,
      password: process.env.PG_PASS,
    },
    migrations: {
      directory: './dist/database/migrations',
      extension: 'js',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default config;

