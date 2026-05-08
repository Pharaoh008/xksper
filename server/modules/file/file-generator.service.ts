import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';

export interface GenerateFileOptions {
  fileName?: string;
  title?: string;
}

export interface GeneratedFile {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

@Injectable()
export class FileGeneratorService {
  private readonly logger = new Logger(FileGeneratorService.name);

  /**
   * 生成 Excel 文件
   */
  generateExcel(data: unknown[][], options: GenerateFileOptions = {}): GeneratedFile {
    const { fileName = 'data.xlsx', title } = options;
    
    // 如果有标题，在第一行插入
    let sheetData = data;
    if (title) {
      sheetData = [[title], ...data];
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet(sheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return {
      buffer: Buffer.from(buffer),
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileName: fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`,
    };
  }

  /**
   * 生成 Word 文件 (简单 HTML 转 docx)
   * 注意：这里使用简单 HTML 格式，实际项目中可能需要更完整的 docx 生成
   */
  generateWord(content: string, options: GenerateFileOptions = {}): GeneratedFile {
    const { fileName = 'document.docx' } = options;
    
    // 创建简单的 Word HTML 格式
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${options.title || 'Document'}</title>
</head>
<body>
  ${content.split('\n').map(line => `<p>${line}</p>`).join('')}
</body>
</html>`;
    
    return {
      buffer: Buffer.from(htmlContent, 'utf-8'),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileName: fileName.endsWith('.docx') ? fileName : `${fileName}.docx`,
    };
  }

  /**
   * 生成 PDF 文件
   */
  generatePdf(content: string, options: GenerateFileOptions = {}): GeneratedFile {
    const { fileName = 'document.pdf', title } = options;
    
    const doc = new jsPDF();
    
    // 添加标题
    let yPosition = 20;
    if (title) {
      doc.setFontSize(16);
      doc.text(title, 20, yPosition);
      yPosition += 15;
    }
    
    // 添加内容
    doc.setFontSize(12);
    const lines = content.split('\n');
    const maxWidth = 170;
    const lineHeight = 7;
    
    lines.forEach((line) => {
      // 处理长文本换行
      const splitLines = doc.splitTextToSize(line, maxWidth);
      
      splitLines.forEach((splitLine: string) => {
        // 检查是否需要新页面
        if (yPosition > 280) {
          doc.addPage();
          yPosition = 20;
        }
        doc.text(splitLine, 20, yPosition);
        yPosition += lineHeight;
      });
    });
    
    const buffer = doc.output('arraybuffer');
    
    return {
      buffer: Buffer.from(buffer),
      mimeType: 'application/pdf',
      fileName: fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`,
    };
  }

  /**
   * 生成 PPT 文件 (简化版本，返回 HTML 格式作为备用)
   * 注意：完整的 PPT 生成需要额外的库，这里使用简化方案
   */
  generatePpt(slides: string[], options: GenerateFileOptions = {}): GeneratedFile {
    const { fileName = 'presentation.pptx' } = options;
    
    // 由于生成真正的 PPTX 比较复杂，这里返回一个结构化的文本文件
    // 实际项目中可以使用 pptxgenjs 等库
    const content = slides.map((slide, index) => 
      `=== 幻灯片 ${index + 1} ===\n${slide}\n`
    ).join('\n');
    
    return {
      buffer: Buffer.from(content, 'utf-8'),
      mimeType: 'text/plain',
      fileName: fileName.endsWith('.txt') ? fileName : `${fileName}.txt`,
    };
  }

  /**
   * 根据文件类型生成文件
   */
  generateFile(
    type: 'excel' | 'word' | 'pdf' | 'ppt',
    content: string | unknown[][],
    options: GenerateFileOptions = {},
  ): GeneratedFile {
    switch (type) {
      case 'excel':
        // Excel 需要二维数组格式
        if (Array.isArray(content)) {
          return this.generateExcel(content, options);
        }
        // 文本内容按行分割
        const lines = (content as string).split('\n').map(line => [line]);
        return this.generateExcel(lines, options);
        
      case 'word':
        return this.generateWord(content as string, options);
        
      case 'pdf':
        return this.generatePdf(content as string, options);
        
      case 'ppt':
        // PPT 需要数组格式
        const slides = Array.isArray(content) 
          ? content.map(item => String(item))
          : (content as string).split('\n---\n');
        return this.generatePpt(slides, options);
        
      default:
        throw new Error(`不支持的文件类型: ${type}`);
    }
  }

  /**
   * 从 AI 响应中提取文件生成请求
   * 支持的格式：
   * [FILE:excel]...[/FILE]
   * [FILE:pdf]...[/FILE]
   * [FILE:word]...[/FILE]
   */
  extractFileGenerations(content: string): Array<{ type: string; content: string; fileName?: string }> {
    const pattern = /\[FILE:(\w+)(?::([^\]]+))?\]([\s\S]*?)\[\/FILE\]/g;
    const results: Array<{ type: string; content: string; fileName?: string }> = [];
    let match;
    
    while ((match = pattern.exec(content)) !== null) {
      const [, type, fileName, fileContent] = match;
      results.push({
        type: type.toLowerCase(),
        content: fileContent.trim(),
        fileName: fileName || undefined,
      });
    }
    
    return results;
  }

  /**
   * 从 AI 响应中移除文件生成标记，保留纯文本
   */
  removeFileGenerationMarkers(content: string): string {
    return content.replace(/\[FILE:\w+(?::[^\]]+)?\]([\s\S]*?)\[\/FILE\]/g, '');
  }
}
