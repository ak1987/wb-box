import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TariffsService } from '../tariffs/tariffs.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private readonly enabled: boolean;

  constructor(private readonly tariffsService: TariffsService) {
    this.enabled = process.env.SCHEDULER_ENABLED !== '0' && process.env.SCHEDULER_ENABLED !== 'false';
    
    if (this.enabled) {
      this.logger.log('Scheduler is ENABLED - will run sync every hour');
    } else {
      this.logger.warn('Scheduler is DISABLED - set SCHEDULER_ENABLED=1 to enable');
    }
  }

  /**
   * Run sync and export every hour at minute 0
   * Cron: 0 * * * * = At minute 0 of every hour
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'hourly-tariff-sync',
  })
  async handleHourlySyncAndExport() {
    if (!this.enabled) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    this.logger.log(`🔄 Starting scheduled sync for ${today}`);

    try {
      const result = await this.tariffsService.syncAndExportTariffs(today);

      if (result.export?.success) {
        this.logger.log(
          `✅ Scheduled sync completed successfully: ${result.warehousesCount} warehouses, ` +
          `exported to ${result.export.exported} spreadsheets`
        );
      } else {
        this.logger.warn(
          `⚠️ Sync completed but export failed: ${result.export?.failed || 0} spreadsheets failed`
        );
      }
    } catch (error) {
      this.logger.error(`❌ Scheduled sync failed: ${error.message}`, error.stack);
    }
  }
}

