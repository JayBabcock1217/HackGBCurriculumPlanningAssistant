import { Injectable } from '@nestjs/common';

export interface TextChunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
  metadata: {
    startIndex: number;
    endIndex: number;
    section?: string;
  };
}

const DEFAULT_CHUNK_SIZE = 1500; // characters per chunk
const DEFAULT_OVERLAP = 200; // characters of overlap between chunks

@Injectable()
export class TextChunkingService {
  chunkText(
    text: string,
    options?: { chunkSize?: number; overlap?: number },
  ): TextChunk[] {
    const chunkSize = options?.chunkSize || DEFAULT_CHUNK_SIZE;
    const overlap = options?.overlap || DEFAULT_OVERLAP;

    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunks: TextChunk[] = [];
    let startIndex = 0;
    let chunkIndex = 0;

    while (startIndex < text.length) {
      // Find a good break point near the chunk size
      let endIndex = Math.min(startIndex + chunkSize, text.length);

      // Try to break at a paragraph boundary
      if (endIndex < text.length) {
        const paragraphEnd = text.lastIndexOf('\n\n', endIndex);
        const sentenceEnd = text.lastIndexOf('.', endIndex);
        const bestBreak = Math.max(paragraphEnd, sentenceEnd);

        // Only use the break point if it's not too far from the chunk size
        if (bestBreak > startIndex + chunkSize * 0.5) {
          endIndex = bestBreak + 1;
        }
      }

      const content = text.slice(startIndex, endIndex).trim();
      if (content.length === 0) break;

      // Estimate token count (roughly 1 token per 4 characters for English)
      const tokenCount = Math.ceil(content.length / 4);

      chunks.push({
        content,
        chunkIndex: chunkIndex,
        tokenCount,
        metadata: {
          startIndex,
          endIndex,
        },
      });

      // Move to the next chunk with overlap
      if (endIndex >= text.length) break;
      startIndex = endIndex - overlap;
      chunkIndex++;
    }

    return chunks;
  }
}
