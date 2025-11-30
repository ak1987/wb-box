#!/usr/bin/env ts-node

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TariffsService } from '../tariffs/tariffs.service';

async function bootstrap() {
  // Get date argument from command line (default to today)
  const args = process.argv.slice(2);
  let date: string;

  if (args.length > 0) {
    date = args[0];
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      console.error('❌ Invalid date format. Use YYYY-MM-DD');
      console.error('Example: npm run sync-tariffs 2025-11-30');
      process.exit(1);
    }
  } else {
    // Use today's date
    date = new Date().toISOString().split('T')[0];
  }

  console.log('=== Wildberries Tariff Sync ===');
  console.log(`Date: ${date}`);
  console.log('================================\n');

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Get services
    const tariffsService = app.get(TariffsService);

    // Sync and export tariffs
    console.log(`🔄 Fetching tariffs from Wildberries API...\n`);
    const result = await tariffsService.syncAndExportTariffs(date);

    console.log('\n✅ Sync completed successfully!');
    console.log('================================');
    console.log(`Date: ${result.date}`);
    console.log(`Warehouses: ${result.warehousesCount}`);
    console.log(`Action: ${result.isUpdate ? 'Updated existing record' : 'Created new record'}`);
    console.log('================================\n');

    if (result.export) {
      if (result.export.success) {
        console.log('✅ Export completed successfully!');
        console.log('================================');
        console.log(`Rows exported: ${result.export.rowsExported}`);
        console.log(`Spreadsheets updated: ${result.export.exported}`);
        console.log('================================\n');
        await app.close();
        process.exit(0);
      } else {
        console.log('⚠️  Export completed with errors!');
        console.log('================================');
        console.log(`Rows exported: ${result.export.rowsExported}`);
        console.log(`Spreadsheets updated: ${result.export.exported}`);
        console.log(`Failed: ${result.export.failed}`);
        console.log('Errors:');
        result.export.errors.forEach((error) => console.log(`  - ${error}`));
        console.log('================================\n');
        await app.close();
        process.exit(1);
      }
    } else {
      console.log('⚠️  No data to export (no warehouses found)\n');
      await app.close();
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Sync failed!');
    console.error('================================');
    console.error(`Error: ${error.message}`);
    console.error('================================\n');
    process.exit(1);
  }
}

bootstrap();

