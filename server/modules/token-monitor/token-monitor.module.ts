import { Module } from '@nestjs/common';
import { TokenMonitorController } from './token-monitor.controller';
import { TokenMonitorService } from './token-monitor.service';

@Module({
  controllers: [TokenMonitorController],
  providers: [TokenMonitorService],
})
export class TokenMonitorModule {}
