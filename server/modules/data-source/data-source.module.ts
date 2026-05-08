import { Module } from '@nestjs/common';
import { DataSourceController } from './data-source.controller';
import { DataSourceService } from './data-source.service';

@Module({
  controllers: [DataSourceController],
  providers: [DataSourceService],
  exports: [DataSourceService],
})
export class DataSourceModule {}
