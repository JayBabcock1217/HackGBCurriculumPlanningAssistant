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
    // pdf-parse v2 exports the PDFParse class (v1 exported a plain function)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfParseModule = require('pdf-parse');
    const PDFParse = pdfParseModule.PDFParse;

    // NOTE: pdfjs spins up a worker via dynamic import, which requires Node's
    // --experimental-vm-modules flag when running under Jest. The `test` and
    // `test:e2e` npm scripts set NODE_OPTIONS accordingly. In a normal
    // (non-Jest) runtime this works out of the box.
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const result = await parser.getText();

    // pdf-parse v2 returns { text, pages, total }; v1 returned a flat string
    const text = typeof result === 'string' ? result : result.text || '';
    const pages =
      typeof result === 'object' && result !== null
        ? result.total ?? result.pages?.length
        : undefined;

    this.logger.log(
      `Parsed PDF: ${pages ?? '?'} pages, ${text.length} characters`,
    );

    return {
      text,
      pages,
      metadata: {
        title: '',
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
