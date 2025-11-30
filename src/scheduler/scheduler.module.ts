import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './scheduler.service';
import { TariffsModule } from '../tariffs/tariffs.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TariffsModule,
  ],
  providers: [SchedulerService],
})
export class SchedulerModule {}

