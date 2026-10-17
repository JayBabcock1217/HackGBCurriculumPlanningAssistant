import { Test, TestingModule } from '@nestjs/testing';
import { DocumentParserService } from './document-parser.service';
import { BadRequestException } from '@nestjs/common';

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
  });

  describe('parse - Word', () => {
    it('should throw for invalid DOCX data', async () => {
      const invalidDocx = Buffer.from('this is not a docx');
      await expect(service.parse(invalidDocx, 'docx')).rejects.toThrow();
    });
  });
});
