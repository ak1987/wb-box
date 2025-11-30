import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { TariffsService, TariffDate, TariffWarehouse } from './tariffs.service';
import { GoogleSheetsService } from '../google-sheets/google-sheets.service';

@Controller('tariffs')
export class TariffsController {
  constructor(
    private readonly tariffsService: TariffsService,
    private readonly googleSheetsService: GoogleSheetsService,
  ) {}

  // Main endpoint - Get tariff with warehouses by date query parameter
  @Get()
  async getTariffWithWarehouses(@Query('date') date: string) {
    if (!date) {
      throw new HttpException(
        {
          success: false,
          message: 'Date query parameter is required. Example: /tariffs?date=2025-11-30',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      throw new HttpException(
        {
          success: false,
          message: 'Invalid date format. Use YYYY-MM-DD',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const result = await this.tariffsService.findTariffWithWarehouses(date);

    if (!result) {
      throw new HttpException(
        {
          success: false,
          message: `No tariff data found for date: ${date}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return result;
  }

  // Tariff Dates endpoints
  @Get('dates')
  async getAllDates(): Promise<TariffDate[]> {
    return this.tariffsService.findAllTariffDates();
  }

  @Get('dates/:date')
  async getDateByDate(@Param('date') date: string): Promise<TariffDate> {
    return this.tariffsService.findTariffDateByDate(date);
  }

  // Tariff Warehouses endpoints (READ ONLY)
  @Get('warehouses')
  async getAllWarehouses(): Promise<TariffWarehouse[]> {
    return this.tariffsService.findAllTariffWarehouses();
  }

  @Get('warehouses/:date')
  async getWarehousesByDate(@Param('date') date: string): Promise<TariffWarehouse[]> {
    return this.tariffsService.findTariffWarehousesByDate(date);
  }

  // Wildberries API Sync endpoints (ADMIN ONLY)
  @Post('sync')
  async syncToday() {
    try {
      const result = await this.tariffsService.syncAndExportTodayTariffs();
      return {
        success: true,
        message: `Successfully synced and exported tariffs for ${result.date}`,
        data: {
          date: result.date,
          warehousesCount: result.warehousesCount,
          isUpdate: result.isUpdate,
        },
        export: result.export,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to sync tariffs: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('sync/:date')
  async syncByDate(@Param('date') date: string) {
    try {
      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        throw new HttpException(
          {
            success: false,
            message: 'Invalid date format. Use YYYY-MM-DD',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.tariffsService.syncAndExportTariffs(date);
      return {
        success: true,
        message: `Successfully synced and exported tariffs for ${result.date}`,
        data: {
          date: result.date,
          warehousesCount: result.warehousesCount,
          isUpdate: result.isUpdate,
        },
        export: result.export,
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: `Failed to sync tariffs: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
  
  // Google Sheets Export endpoints (ADMIN ONLY)
  @Post('export')
  async exportToGoogleSheets(@Query('date') date?: string) {
    try {
      // Get export data
      const data = await this.tariffsService.getExportData(date);
      
      if (data.length === 0) {
        throw new HttpException(
          {
            success: false,
            message: date 
              ? `No data found for date: ${date}`
              : 'No data found to export',
          },
          HttpStatus.NOT_FOUND,
        );
      }

      // Export to Google Sheets
      const result = await this.googleSheetsService.exportToAllSpreadsheets(data);

      if (!result.success) {
        throw new HttpException(
          {
            success: false,
            message: 'Export completed with errors',
            ...result,
          },
          HttpStatus.PARTIAL_CONTENT,
        );
      }

      return {
        success: true,
        message: 'Successfully exported to Google Sheets',
        rowsExported: data.length,
        ...result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        {
          success: false,
          message: `Failed to export: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

