import { Test, TestingModule } from '@nestjs/testing';
import { DocumentParserService } from './document-parser.service';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

const PDF_FIXTURE = path.join(__dirname, '../../test/fixtures/math-unit1.pdf');

/**
 * Build a minimal valid DOCX (a ZIP containing OOXML parts) in memory.
 * jszip is available as a transitive dependency of mammoth.
 */
async function buildMinimalDocx(paragraphText: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const JSZip = require('jszip');
  const zip = new JSZip();

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p>
<w:r><w:t>${paragraphText}</w:t></w:r>
</w:p>
</w:body>
</w:document>`;

  zip.file('[Content_Types].xml', contentTypes);
  zip.file('_rels/.rels', rels);
  zip.file('word/document.xml', document);

  return zip.generateAsync({ type: 'nodebuffer' });
}

describe('DocumentParserService', () => {
  let service: DocumentParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DocumentParserService],
    }).compile();

    service = module.get<DocumentParserService>(DocumentParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parse', () => {
    it('should throw for unsupported file type', async () => {
      const buffer = Buffer.from('test');
      await expect(service.parse(buffer, 'txt')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw for unknown file type', async () => {
      const buffer = Buffer.from('test');
      await expect(service.parse(buffer, 'unknown')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw with descriptive error message', async () => {
      const buffer = Buffer.from('test');
      await expect(service.parse(buffer, 'xls')).rejects.toThrow(
        'Unsupported file type: xls',
      );
    });
  });

  describe('parse - PDF', () => {
    it('should throw for invalid PDF data', async () => {
      const invalidPdf = Buffer.from('this is not a pdf');
      await expect(service.parse(invalidPdf, 'pdf')).rejects.toThrow();
    });

    it('should extract text from a valid PDF (real fixture)', async () => {
      expect(fs.existsSync(PDF_FIXTURE)).toBe(true);
      const buffer = fs.readFileSync(PDF_FIXTURE);

      const result = await service.parse(buffer, 'pdf');

      expect(result.text.length).toBeGreaterThan(200);
      expect(result.pages).toBe(1);
      // Verify the actual lesson content was extracted
      const lower = result.text.toLowerCase();
      expect(result.text).toContain('Third Grade Math');
      expect(lower).toContain('addition');
      expect(lower).toContain('subtraction');
      expect(lower).toContain('regrouping');
      expect(result.text).toContain('34 plus 25');
    });

    it('should be case-insensitive for file type', async () => {
      const buffer = fs.readFileSync(PDF_FIXTURE);
      const result = await service.parse(buffer, 'PDF');
      expect(result.text).toContain('Third Grade Math');
    });
  });

  describe('parse - Word', () => {
    it('should throw for invalid DOCX data', async () => {
      const invalidDocx = Buffer.from('this is not a docx');
      await expect(service.parse(invalidDocx, 'docx')).rejects.toThrow();
    });

    it('should extract text from a valid DOCX (real file)', async () => {
      const docxBuffer = await buildMinimalDocx(
        'Science - Life Cycles: A student-friendly lesson on metamorphosis, including stages of a butterfly and frog life cycle with diagrams.',
      );

      const result = await service.parse(docxBuffer, 'docx');

      expect(result.text).toContain('Science - Life Cycles');
      expect(result.text).toContain('metamorphosis');
      expect(result.text).toContain('butterfly');
      expect(result.metadata).toBeDefined();
    });

    it('should be case-insensitive for file type (word)', async () => {
      const docxBuffer = await buildMinimalDocx('Hello Word Document');
      const result = await service.parse(docxBuffer, 'word');
      expect(result.text).toContain('Hello Word Document');
    });
  });
});
