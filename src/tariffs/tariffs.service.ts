import { Injectable, Inject, Logger } from '@nestjs/common';
import { Knex } from 'knex';
import { KNEX_CONNECTION } from '../database/database.module';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';
import { withRetry } from '../common/retry.util';

export interface TariffDate {
  date: string;
  dtNextBox?: string;
  dtTillMax?: string;
}

export interface TariffWarehouse {
  tariff_date: string;
  boxDeliveryBase?: number;
  boxDeliveryCoefExpr?: number;
  boxDeliveryLiter?: number;
  boxDeliveryMarketplaceBase?: number;
  boxDeliveryMarketplaceCoefExpr?: number;
  boxDeliveryMarketplaceLiter?: number;
  boxStorageBase?: number;
  boxStorageCoefExpr?: number;
  boxStorageLiter?: number;
  geoName?: string;
  warehouseName?: string;
}

interface WBTariffResponse {
  response: {
    data: {
      dtNextBox: string | null;
      dtTillMax: string | null;
      warehouseList: Array<{
        boxDeliveryBase: string | number;
        boxDeliveryCoefExpr?: string | number;
        boxDeliveryLiter: string | number;
        boxDeliveryMarketplaceBase?: string | number;
        boxDeliveryMarketplaceCoefExpr?: string | number;
        boxDeliveryMarketplaceLiter?: string | number;
        boxStorageBase: string | number;
        boxStorageCoefExpr?: string | number;
        boxStorageLiter: string | number;
        geoName?: string;
        warehouseName: string;
      }>;
    };
  };
}

@Injectable()
export class TariffsService {
  private readonly logger = new Logger(TariffsService.name);
  private readonly apiToken: string;
  private readonly baseUrl = 'https://common-api.wildberries.ru/api/v1';

  constructor(
    @Inject(KNEX_CONNECTION)
    private readonly knex: Knex,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {
    this.apiToken = process.env.WB_API_TOKEN || '';
    if (!this.apiToken) {
      this.logger.warn('WB_API_TOKEN is not set. API calls will fail.');
    }
  }

  // Tariff Dates methods
  async findAllTariffDates(): Promise<TariffDate[]> {
    return this.knex('tariff_dates').select('*').orderBy('date', 'desc');
  }

  async findTariffDateByDate(date: string): Promise<TariffDate> {
    return this.knex('tariff_dates').where('date', date).first();
  }

  async findTariffWithWarehouses(date: string): Promise<{
    date: string;
    dtNextBox?: string;
    dtTillMax?: string;
    created_at?: Date;
    updated_at?: Date;
    warehouses: TariffWarehouse[];
  } | null> {
    const tariffDate = await this.knex('tariff_dates').where('date', date).first();
    
    if (!tariffDate) {
      return null;
    }

    const warehouses = await this.knex('tariff_warehouses')
      .where('tariff_date', date)
      .select('*');

    return {
      ...tariffDate,
      warehouses,
    };
  }

  // Tariff Warehouses methods (READ ONLY)
  async findAllTariffWarehouses(): Promise<TariffWarehouse[]> {
    return this.knex('tariff_warehouses').select('*');
  }

  async findTariffWarehousesByDate(date: string): Promise<TariffWarehouse[]> {
    return this.knex('tariff_warehouses').where('tariff_date', date);
  }

  // Helper functions for parsing ugly API data
  /**
   * Parse ugly API string to number (handles comma decimals and '-' as null)
   * Examples: "1,234" -> 1.234, "-" -> null, "0" -> 0
   */
  private parseApiNumber(value: string | number | undefined | null): number | null {
    if (value === undefined || value === null || value === '-' || value === '') {
      return null;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    // Replace comma with dot for decimal separator
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    
    return isNaN(parsed) ? null : parsed;
  }

  /**
   * Parse ugly API date string (handles '-' as null)
   */
  private parseApiDate(value: string | null | undefined): string | null {
    if (!value || value === '-' || value === '') {
      return null;
    }
    return value;
  }

  /**
   * Fetch tariff data from Wildberries API with retry logic
   */
  async fetchTariffsFromAPI(date: string): Promise<WBTariffResponse> {
    const url = `${this.baseUrl}/tariffs/box?date=${date}`;
    
    this.logger.log(`Fetching tariffs from: ${url}`);

    return withRetry(
      async () => {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': this.apiToken,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
      },
      {
        maxAttempts: 3,
        delayMs: 2000,
        backoffMultiplier: 2,
      },
      this.logger,
      `Fetch tariffs from Wildberries API (${date})`,
    );
  }

  /**
   * Parse and store tariff data from Wildberries API
   * Logic: Check if record exists in tariff_dates. If exists, delete all warehouse records for that date and insert new ones.
   */
  async syncTariffsFromAPI(date: string): Promise<{
    date: string;
    warehousesCount: number;
    isUpdate: boolean;
  }> {
    this.logger.log(`Syncing tariffs from API for date: ${date}`);

    try {
      // Fetch data from API
      const apiData = await this.fetchTariffsFromAPI(date);
      const { dtNextBox, dtTillMax, warehouseList } = apiData.response.data;

      // Parse dates with ugly format handling
      const parsedDtNextBox = this.parseApiDate(dtNextBox);
      const parsedDtTillMax = this.parseApiDate(dtTillMax);

      // Use transaction to ensure data consistency
      return await this.knex.transaction(async (trx) => {
        // 1. Check if tariff_dates record exists
        const existingDate = await trx('tariff_dates')
          .where('date', date)
          .first();

        let isUpdate = false;

        if (existingDate) {
          // Record exists - update it
          isUpdate = true;
          await trx('tariff_dates')
            .where('date', date)
            .update({
              dtNextBox: parsedDtNextBox,
              dtTillMax: parsedDtTillMax,
              updated_at: trx.fn.now(),
            });
          this.logger.log(`Updated tariff_dates for ${date}`);

          // Delete all warehouse records for this date
          const deletedCount = await trx('tariff_warehouses')
            .where('tariff_date', date)
            .delete();
          
          if (deletedCount > 0) {
            this.logger.log(`Deleted ${deletedCount} existing warehouse records for ${date}`);
          }
        } else {
          // Record doesn't exist - insert it
          await trx('tariff_dates').insert({
            date,
            dtNextBox: parsedDtNextBox,
            dtTillMax: parsedDtTillMax,
          });
          this.logger.log(`Inserted tariff_dates for ${date}`);
        }

        // 3. Insert new warehouse data with ugly format parsing
        if (warehouseList && warehouseList.length > 0) {
          const warehouseRecords = warehouseList.map((warehouse) => ({
            tariff_date: date,
            boxDeliveryBase: this.parseApiNumber(warehouse.boxDeliveryBase),
            boxDeliveryCoefExpr: this.parseApiNumber(warehouse.boxDeliveryCoefExpr),
            boxDeliveryLiter: this.parseApiNumber(warehouse.boxDeliveryLiter),
            boxDeliveryMarketplaceBase: this.parseApiNumber(warehouse.boxDeliveryMarketplaceBase),
            boxDeliveryMarketplaceCoefExpr: this.parseApiNumber(warehouse.boxDeliveryMarketplaceCoefExpr),
            boxDeliveryMarketplaceLiter: this.parseApiNumber(warehouse.boxDeliveryMarketplaceLiter),
            boxStorageBase: this.parseApiNumber(warehouse.boxStorageBase),
            boxStorageCoefExpr: this.parseApiNumber(warehouse.boxStorageCoefExpr),
            boxStorageLiter: this.parseApiNumber(warehouse.boxStorageLiter),
            geoName: warehouse.geoName || null,
            warehouseName: warehouse.warehouseName,
          }));

          await trx('tariff_warehouses').insert(warehouseRecords);
          this.logger.log(`Inserted ${warehouseRecords.length} warehouse records for ${date}`);
        }

        return {
          date,
          warehousesCount: warehouseList?.length || 0,
          isUpdate,
        };
      });
    } catch (error) {
      this.logger.error(`Failed to sync tariffs from API: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get export data: tariff_dates LEFT JOIN tariff_warehouses, sorted by configurable column
   */
  async getExportData(date?: string): Promise<any[]> {
    // Whitelist of allowed sorting columns to prevent SQL injection
    const allowedSortColumns = [
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

    let query = this.knex('tariff_dates')
      .leftJoin('tariff_warehouses', 'tariff_dates.date', 'tariff_warehouses.tariff_date')
      .select(
        'tariff_dates.updated_at',
        'tariff_dates.dtNextBox',
        'tariff_dates.dtTillMax',
        'tariff_warehouses.tariff_date',
        'tariff_warehouses.boxDeliveryBase',
        'tariff_warehouses.boxDeliveryCoefExpr',
        'tariff_warehouses.boxDeliveryLiter',
        'tariff_warehouses.boxDeliveryMarketplaceBase',
        'tariff_warehouses.boxDeliveryMarketplaceCoefExpr',
        'tariff_warehouses.boxDeliveryMarketplaceLiter',
        'tariff_warehouses.boxStorageBase',
        'tariff_warehouses.boxStorageCoefExpr',
        'tariff_warehouses.boxStorageLiter',
        'tariff_warehouses.geoName',
        'tariff_warehouses.warehouseName',
      );

    // Filter by date if provided
    if (date) {
      query = query.where('tariff_dates.date', date);
    }

    // Get sorting configuration from environment with whitelist validation
    const sortColumnInput = process.env.EXPORT_SORTING_COLUMN || 'boxDeliveryCoefExpr';
    const sortColumn = allowedSortColumns.includes(sortColumnInput) 
      ? sortColumnInput 
      : 'boxDeliveryCoefExpr';
    
    if (!allowedSortColumns.includes(sortColumnInput)) {
      this.logger.warn(
        `Invalid EXPORT_SORTING_COLUMN: "${sortColumnInput}". Using default: "boxDeliveryCoefExpr"`
      );
    }

    const sortAsc = process.env.EXPORT_SORTING_ASC === '1' || process.env.EXPORT_SORTING_ASC === 'true';
    const sortDirection = sortAsc ? 'ASC' : 'DESC';

    // Sort by validated column (nulls last) - safe from SQL injection
    query = query.orderByRaw(`tariff_warehouses."${sortColumn}" ${sortDirection} NULLS LAST`);

    const results = await query;
    return results;
  }

  /**
   * Complete workflow: Sync tariffs from API and export to Google Sheets
   * This is the single source of truth for the sync+export operation
   */
  async syncAndExportTariffs(date: string): Promise<{
    date: string;
    warehousesCount: number;
    isUpdate: boolean;
    export: {
      success: boolean;
      exported: number;
      failed: number;
      errors: string[];
      rowsExported: number;
    } | null;
  }> {
    this.logger.log(`Starting sync and export workflow for date: ${date}`);

    // Step 1: Sync tariffs from API
    const syncResult = await this.syncTariffsFromAPI(date);
    this.logger.log(`Sync completed: ${syncResult.warehousesCount} warehouses`);

    // Step 2: Get export data
    const exportData = await this.getExportData(date);
    
    if (exportData.length === 0) {
      this.logger.warn('No data to export (no warehouses found)');
      return {
        ...syncResult,
        export: null,
      };
    }

    // Step 3: Export to Google Sheets
    let exportResult = null;
    try {
      const sheetsResult = await this.googleSheetsService.exportToAllSpreadsheets(exportData);
      exportResult = {
        ...sheetsResult,
        rowsExported: exportData.length,
      };
      this.logger.log(`Export completed: ${sheetsResult.exported} spreadsheets updated`);
    } catch (error) {
      this.logger.error(`Export to Google Sheets failed: ${error.message}`);
      exportResult = {
        success: false,
        exported: 0,
        failed: 0,
        errors: [error.message],
        rowsExported: exportData.length,
      };
    }

    return {
      ...syncResult,
      export: exportResult,
    };
  }

  /**
   * Sync and export tariffs for today
   */
  async syncAndExportTodayTariffs(): Promise<{
    date: string;
    warehousesCount: number;
    isUpdate: boolean;
    export: any;
  }> {
    const today = new Date().toISOString().split('T')[0];
    return this.syncAndExportTariffs(today);
  }
}

