import { Module } from '@nestjs/common';
import { FileParserService } from './file-parser.service';
import { FileGeneratorService } from './file-generator.service';
import { FileController } from './file.controller';

@Module({
  controllers: [FileController],
  providers: [FileParserService, FileGeneratorService],
  exports: [FileParserService, FileGeneratorService],
})
export class FileModule {}
