import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('tariff_warehouses', (table) => {
    // Foreign key to tariff_dates
    table.date('tariff_date').notNullable();
    table.foreign('tariff_date').references('date').inTable('tariff_dates').onDelete('CASCADE');
    
    // Float fields with 3 decimal precision
    table.decimal('boxDeliveryBase', 10, 3).nullable();
    table.decimal('boxDeliveryCoefExpr', 10, 3).nullable();
    table.decimal('boxDeliveryLiter', 10, 3).nullable();
    table.decimal('boxDeliveryMarketplaceBase', 10, 3).nullable();
    table.decimal('boxDeliveryMarketplaceCoefExpr', 10, 3).nullable();
    table.decimal('boxDeliveryMarketplaceLiter', 10, 3).nullable();
    table.decimal('boxStorageBase', 10, 3).nullable();
    table.decimal('boxStorageCoefExpr', 10, 3).nullable();
    table.decimal('boxStorageLiter', 10, 3).nullable();
    
    // String fields
    table.string('geoName', 512).nullable();
    table.string('warehouseName', 512).nullable();
    
    table.timestamps(true, true);
    
    // Index on foreign key for better performance
    table.index('tariff_date');
  });
}

export async function down(knex: Knex): Promise<void> {
  return knex.schema.dropTableIfExists('tariff_warehouses');
}

