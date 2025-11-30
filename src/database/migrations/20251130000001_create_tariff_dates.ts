import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('tariff_dates', (table) => {
    table.date('date').primary().notNullable();
    table.date('dtNextBox').nullable();
    table.date('dtTillMax').nullable();
    
    table.timestamps(true, true);
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('tariff_dates');
}

