import { Module } from '@nestjs/common';
import { TariffsService } from './tariffs.service';
import { TariffsController } from './tariffs.controller';
import { GoogleSheetsModule } from '../google-sheets/google-sheets.module';

@Module({
  imports: [GoogleSheetsModule],
  controllers: [TariffsController],
  providers: [TariffsService],
  exports: [TariffsService],
})
export class TariffsModule {}
