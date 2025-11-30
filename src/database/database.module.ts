import { Module, Global } from '@nestjs/common';
import { knex, Knex } from 'knex';
import { knexConfig } from './knex.config';

export const KNEX_CONNECTION = 'KNEX_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: KNEX_CONNECTION,
      useFactory: async (): Promise<Knex> => {
        const knexInstance = knex(knexConfig);
        return knexInstance;
      },
    },
  ],
  exports: [KNEX_CONNECTION],
})
export class DatabaseModule {}

