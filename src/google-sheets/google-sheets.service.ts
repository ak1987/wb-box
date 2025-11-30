import { Injectable, Logger } from '@nestjs/common';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import * as fs from 'fs';
import * as path from 'path';
import { withRetry } from '../common/retry.util';

interface ExportRow {
  updated_at: string;
  dtNextBox: string | null;
  dtTillMax: string | null;
  tariff_date: string;
  boxDeliveryBase: string | null;
  boxDeliveryCoefExpr: string | null;
  boxDeliveryLiter: string | null;
  boxDeliveryMarketplaceBase: string | null;
  boxDeliveryMarketplaceCoefExpr: string | null;
  boxDeliveryMarketplaceLiter: string | null;
  boxStorageBase: string | null;
  boxStorageCoefExpr: string | null;
  boxStorageLiter: string | null;
  geoName: string | null;
  warehouseName: string | null;
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private readonly spreadsheetIds: string[];
  private readonly keyFilePath: string;
  private readonly decimalSeparator: string;

  constructor() {
    // Parse spreadsheet IDs from environment
    const spreadsheetsEnv = process.env.GOOGLE_SPREADSHEETS || '[]';
    try {
      this.spreadsheetIds = JSON.parse(spreadsheetsEnv);
    } catch (error) {
      this.logger.error('Failed to parse GOOGLE_SPREADSHEETS. Using empty array.');
      this.spreadsheetIds = [];
    }

    // Get key file path
    const keyFile = process.env.GOOGLE_SERVICE_ACCOUNT_KEYFILE || 'key.json';
    this.keyFilePath = path.resolve(process.cwd(), 'keys', keyFile);

    // Get decimal separator
    this.decimalSeparator = process.env.EXPORT_DECIMAL_SEPARATOR || ',';

    if (this.spreadsheetIds.length === 0) {
      this.logger.warn('No spreadsheet IDs configured');
    }

    if (!fs.existsSync(this.keyFilePath)) {
      this.logger.warn(`Service account key file not found: ${this.keyFilePath}`);
    }
  }

  /**
   * Format number with configured decimal separator
   */
  private formatNumber(value: number | string | null): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) {
      return null;
    }

    // Convert to string and replace dot with configured separator
    return numValue.toString().replace('.', this.decimalSeparator);
  }

  /**
   * Format date to string (date only)
   */
  private formatDate(value: Date | string | null): string | null {
    if (!value) return null;
    
    if (value instanceof Date) {
      return value.toISOString().split('T')[0];
    }
    
    // If it's already a string, try to parse and format it
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date.toISOString().split('T')[0];
  }

  /**
   * Format datetime to string (date and time)
   */
  private formatDateTime(value: Date | string | null): string | null {
    if (!value) return null;
    
    if (value instanceof Date) {
      return value.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
    }
    
    // If it's already a string, try to parse and format it
    const date = new Date(value);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, '');
  }

  /**
   * Get authenticated Google Spreadsheet document (v3 API)
   */
  private async getSpreadsheet(spreadsheetId: string): Promise<GoogleSpreadsheet> {
    // Load service account credentials
    const creds = JSON.parse(fs.readFileSync(this.keyFilePath, 'utf8'));

    // Initialize the sheet
    const doc = new GoogleSpreadsheet(spreadsheetId);
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();

    return doc;
  }

  /**
   * Export data to a single Google Spreadsheet with retry logic
   */
  private async exportToSpreadsheet(
    spreadsheetId: string,
    rows: ExportRow[],
  ): Promise<void> {
    this.logger.log(`Exporting to spreadsheet: ${spreadsheetId}`);

    return withRetry(
      async () => {
        const doc = await this.getSpreadsheet(spreadsheetId);
        this.logger.log(`Spreadsheet title: ${doc.title}`);

        // Get or create the first sheet
        let sheet = doc.sheetsByIndex[0];
        if (!sheet) {
          sheet = await doc.addSheet({ headerValues: [] });
        }

        // Clear all existing data
        await sheet.clear();
        this.logger.log('Cleared existing data');

        // Set headers
        const headers = [
          'updated_at',
          'dtNextBox',
          'dtTillMax',
          'tariff_date',
          'boxDeliveryBase',
          'boxDeliveryCoefExpr',
          'boxDeliveryLiter',
          'boxDeliveryMarketplaceBase',
          'boxDeliveryMarketplaceCoefExpr',
          'boxDeliveryMarketplaceLiter',
          'boxStorageBase',
          'boxStorageCoefExpr',
          'boxStorageLiter',
          'geoName',
          'warehouseName',
        ];

        await sheet.setHeaderRow(headers);

        // Format rows for export
        const formattedRows = rows.map((row) => ({
          updated_at: this.formatDateTime(row.updated_at) || '',
          dtNextBox: this.formatDate(row.dtNextBox) || '',
          dtTillMax: this.formatDate(row.dtTillMax) || '',
          tariff_date: this.formatDate(row.tariff_date) || '',
          boxDeliveryBase: this.formatNumber(row.boxDeliveryBase) || '',
          boxDeliveryCoefExpr: this.formatNumber(row.boxDeliveryCoefExpr) || '',
          boxDeliveryLiter: this.formatNumber(row.boxDeliveryLiter) || '',
          boxDeliveryMarketplaceBase: this.formatNumber(row.boxDeliveryMarketplaceBase) || '',
          boxDeliveryMarketplaceCoefExpr: this.formatNumber(row.boxDeliveryMarketplaceCoefExpr) || '',
          boxDeliveryMarketplaceLiter: this.formatNumber(row.boxDeliveryMarketplaceLiter) || '',
          boxStorageBase: this.formatNumber(row.boxStorageBase) || '',
          boxStorageCoefExpr: this.formatNumber(row.boxStorageCoefExpr) || '',
          boxStorageLiter: this.formatNumber(row.boxStorageLiter) || '',
          geoName: row.geoName || '',
          warehouseName: row.warehouseName || '',
        }));

        // Add rows in batches
        if (formattedRows.length > 0) {
          await sheet.addRows(formattedRows);
          this.logger.log(`Exported ${formattedRows.length} rows`);
        }
      },
      {
        maxAttempts: 3,
        delayMs: 1000,
        backoffMultiplier: 2,
      },
      this.logger,
      `Export to Google Spreadsheet (${spreadsheetId})`,
    );
  }

  /**
   * Export data to all configured Google Spreadsheets
   */
  async exportToAllSpreadsheets(rows: ExportRow[]): Promise<{
    success: boolean;
    exported: number;
    failed: number;
    errors: string[];
  }> {
    if (this.spreadsheetIds.length === 0) {
      throw new Error('No spreadsheet IDs configured');
    }

    if (!fs.existsSync(this.keyFilePath)) {
      throw new Error(`Service account key file not found: ${this.keyFilePath}`);
    }

    const errors: string[] = [];
    let exported = 0;
    let failed = 0;

    for (let i = 0; i < this.spreadsheetIds.length; i++) {
      const spreadsheetId = this.spreadsheetIds[i];
      
      try {
        await this.exportToSpreadsheet(spreadsheetId, rows);
        exported++;
        
        // Add 500ms delay between exports (except for the last one)
        if (i < this.spreadsheetIds.length - 1) {
          this.logger.log('Waiting 500ms before next export...');
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } catch (error) {
        failed++;
        const errorMsg = `Failed to export to ${spreadsheetId}: ${error.message}`;
        this.logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return {
      success: failed === 0,
      exported,
      failed,
      errors,
    };
  }
}

