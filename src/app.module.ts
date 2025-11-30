import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { TariffsModule } from './tariffs/tariffs.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [DatabaseModule, TariffsModule, SchedulerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
