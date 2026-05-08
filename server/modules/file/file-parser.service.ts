import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import * as mammoth from 'mammoth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export interface ParsedFile {
  type: 'excel' | 'word' | 'pdf' | 'ppt' | 'image' | 'text' | 'unknown';
  content: string;
  metadata?: {
    sheets?: string[];
    pages?: number;
    slideCount?: number;
    [key: string]: unknown;
  };
}

@Injectable()
export class FileParserService {
  private readonly logger = new Logger(FileParserService.name);

  /**
   * 根据文件类型解析文件内容
   */
  async parseFile(buffer: Buffer, mimeType: string, fileName: string): Promise<ParsedFile> {
    const extension = fileName.split('.').pop()?.toLowerCase() || '';
    
    try {
      // Excel 文件
      if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || 
          extension === 'xlsx' || extension === 'xls') {
        return await this.parseExcel(buffer);
      }
      
      // Word 文件
      if (mimeType.includes('word') || mimeType.includes('document') || 
          extension === 'docx' || extension === 'doc') {
        return await this.parseWord(buffer);
      }
      
      // PDF 文件
      if (mimeType === 'application/pdf' || extension === 'pdf') {
        return await this.parsePdf(buffer);
      }
      
      // PPT 文件
      if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || 
          extension === 'pptx' || extension === 'ppt') {
        return await this.parsePpt(buffer);
      }
      
      // 文本文件
      if (mimeType.startsWith('text/') || ['txt', 'md', 'json', 'csv'].includes(extension)) {
        return this.parseText(buffer);
      }
      
      return {
        type: 'unknown',
        content: `[无法解析的文件类型: ${mimeType || extension}]`,
      };
    } catch (error) {
      this.logger.error(`文件解析失败: ${fileName}`, error);
      return {
        type: 'unknown',
        content: `[文件解析失败: ${error.message}]`,
      };
    }
  }

  /**
   * 解析 Excel 文件
   */
  private async parseExcel(buffer: Buffer): Promise<ParsedFile> {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets = workbook.SheetNames;
    
    let content = '';
    sheets.forEach((sheetName, index) => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      content += `\n=== 工作表: ${sheetName} ===\n`;
      
      // 限制行数，避免内容过长
      const maxRows = 100;
      const rows = jsonData.slice(0, maxRows) as unknown[][];
      
      rows.forEach((row) => {
        const rowText = row.map(cell => String(cell || '')).join('\t');
        if (rowText.trim()) {
          content += rowText + '\n';
        }
      });
      
      if (jsonData.length > maxRows) {
        content += `... (还有 ${jsonData.length - maxRows} 行未显示)\n`;
      }
    });

    return {
      type: 'excel',
      content: content.trim(),
      metadata: { sheets },
    };
  }

  /**
   * 解析 Word 文件
   */
  private async parseWord(buffer: Buffer): Promise<ParsedFile> {
    const result = await mammoth.extractRawText({ buffer });
    return {
      type: 'word',
      content: result.value,
      metadata: { 
        messages: result.messages.map(m => m.message),
      },
    };
  }

  /**
   * 解析 PDF 文件
   */
  private async parsePdf(buffer: Buffer): Promise<ParsedFile> {
    const data = await pdfParse(buffer);
    return {
      type: 'pdf',
      content: data.text,
      metadata: { 
        pages: data.numpages,
        info: data.info,
      },
    };
  }

  /**
   * 解析 PPT 文件
   * 注意：服务端 PPT 解析较复杂，当前返回提示信息
   */
  private async parsePpt(buffer: Buffer): Promise<ParsedFile> {
    // PPT 文件解析需要专门的库，服务端实现较复杂
    // 返回提示信息，建议用户手动描述或使用其他方式
    return {
      type: 'ppt',
      content: '[PPT/PPTX 文件]\n\n系统暂无法直接提取 PPT 文件内容。\n建议：\n1. 将 PPT 内容转换为 PDF 后上传\n2. 手动复制 PPT 中的文字内容粘贴到对话框\n3. 使用在线工具将 PPT 转为文档后上传',
      metadata: { 
        size: buffer.length,
        note: 'PPT parsing not supported in server environment',
      },
    };
  }

  /**
   * 解析文本文件
   */
  private parseText(buffer: Buffer): ParsedFile {
    const content = buffer.toString('utf-8');
    return {
      type: 'text',
      content: content.slice(0, 50000), // 限制最大长度
    };
  }
}
