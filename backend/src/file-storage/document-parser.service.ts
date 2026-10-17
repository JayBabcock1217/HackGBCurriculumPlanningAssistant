import { Injectable, Logger, BadRequestException } from '@nestjs/common';

export interface ParsedDocument {
  text: string;
  pages?: number;
  metadata: Record<string, unknown>;
}

@Injectable()
export class DocumentParserService {
  private readonly logger = new Logger(DocumentParserService.name);

  async parse(buffer: Buffer, fileType: string): Promise<ParsedDocument> {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return this.parsePdf(buffer);
      case 'docx':
      case 'word':
        return this.parseWord(buffer);
      default:
        throw new BadRequestException(
          `Unsupported file type: ${fileType}. Supported: PDF, DOCX`,
        );
    }
  }

  private async parsePdf(buffer: Buffer): Promise<ParsedDocument> {
    // pdf-parse is a CommonJS module that doesn't play well with dynamic import
    // in ESM contexts, so we use require
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);

    this.logger.log(
      `Parsed PDF: ${data.numpages} pages, ${data.text.length} characters`,
    );

    return {
      text: data.text,
      pages: data.numpages,
      metadata: {
        info: data.info || {},
        subject: data.info?.Subject || '',
        title: data.info?.Title || '',
      },
    };
  }

  private async parseWord(buffer: Buffer): Promise<ParsedDocument> {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });

    const text = result.value;
    this.logger.log(`Parsed Word: ${text.length} characters`);

    return {
      text,
      metadata: {
        messages: result.messages || [],
      },
    };
  }
}
