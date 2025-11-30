#!/usr/bin/env ts-node

import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { TariffsService } from '../tariffs/tariffs.service';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';

async function bootstrap() {
  // Get date argument from command line (optional)
  const args = process.argv.slice(2);
  let date: string | undefined;

  if (args.length > 0) {
    date = args[0];
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      console.error('❌ Invalid date format. Use YYYY-MM-DD');
      console.error('Example: npm run export-tariffs 2025-11-30');
      process.exit(1);
    }
  }

  console.log('=== Google Sheets Export ===');
  console.log(`Date filter: ${date || 'All dates'}`);
  console.log('============================\n');

  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    // Get services
    const tariffsService = app.get(TariffsService);
    const googleSheetsService = app.get(GoogleSheetsService);

    // Get export data
    console.log(`📊 Fetching data from database...\n`);
    const data = await tariffsService.getExportData(date);

    if (data.length === 0) {
      console.error('❌ No data found to export');
      await app.close();
      process.exit(1);
    }

    console.log(`Found ${data.length} rows to export\n`);

    // Export to Google Sheets
    console.log(`📤 Exporting to Google Sheets...\n`);
    const result = await googleSheetsService.exportToAllSpreadsheets(data);

    if (result.success) {
      console.log('\n✅ Export completed successfully!');
      console.log('============================');
      console.log(`Rows exported: ${data.length}`);
      console.log(`Spreadsheets updated: ${result.exported}`);
      console.log('============================\n');
    } else {
      console.log('\n⚠️  Export completed with errors!');
      console.log('============================');
      console.log(`Rows exported: ${data.length}`);
      console.log(`Spreadsheets updated: ${result.exported}`);
      console.log(`Failed: ${result.failed}`);
      console.log('Errors:');
      result.errors.forEach((error) => console.log(`  - ${error}`));
      console.log('============================\n');
    }

    await app.close();
    process.exit(result.success ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Export failed!');
    console.error('============================');
    console.error(`Error: ${error.message}`);
    console.error('============================\n');
    process.exit(1);
  }
}

bootstrap();

