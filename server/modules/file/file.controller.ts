import { Controller, Post, Body, UseInterceptors, UploadedFile, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { NeedLogin } from '@lark-apaas/fullstack-nestjs-core';
import { FileParserService } from './file-parser.service';
import { FileGeneratorService } from './file-generator.service';

export interface ParseFileRequest {
  fileName: string;
  mimeType: string;
  base64Data: string;
}

export interface GenerateFileRequest {
  type: 'excel' | 'word' | 'pdf' | 'ppt';
  content: string;
  options?: {
    fileName?: string;
    title?: string;
  };
}

@Controller('api/files')
@NeedLogin()
export class FileController {
  private readonly logger = new Logger(FileController.name);

  constructor(
    private readonly fileParserService: FileParserService,
    private readonly fileGeneratorService: FileGeneratorService,
  ) {}

  /**
   * 解析上传的文件
   */
  @Post('parse')
  async parseFile(@Body() dto: ParseFileRequest) {
    this.logger.log(`解析文件: ${dto.fileName}, MIME: ${dto.mimeType}`);
    
    const buffer = Buffer.from(dto.base64Data, 'base64');
    const result = await this.fileParserService.parseFile(buffer, dto.mimeType, dto.fileName);
    
    return {
      success: true,
      data: result,
    };
  }

  /**
   * 生成文件
   */
  @Post('generate')
  async generateFile(@Body() dto: GenerateFileRequest) {
    this.logger.log(`生成文件: type=${dto.type}, fileName=${dto.options?.fileName || 'default'}`);
    
    const result = this.fileGeneratorService.generateFile(
      dto.type,
      dto.content,
      dto.options || {},
    );
    
    return {
      success: true,
      data: {
        fileName: result.fileName,
        mimeType: result.mimeType,
        base64Data: result.buffer.toString('base64'),
      },
    };
  }
}
