import { Injectable, Logger } from '@nestjs/common';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount: number;
}

/**
 * EmbeddingService
 *
 * This service generates vector embeddings for text.
 * In production, this will call the LLM Gateway (Chunk 4)
 * to use either a local model (Ollama) or cloud model (OpenAI).
 *
 * For now, it provides a deterministic pseudo-embedding
 * based on character frequency, so the full pipeline can
 * be tested end-to-end before the LLM Gateway is built.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  // Dimension of our pseudo-embeddings
  private readonly DIMENSIONS = 384;

  async embedText(text: string): Promise<EmbeddingResult> {
    const embedding = this.generatePseudoEmbedding(text);
    return {
      embedding,
      model: 'pseudo-embedding-v1',
      tokenCount: Math.ceil(text.length / 4),
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return Promise.all(texts.map((t) => this.embedText(t)));
  }

  /**
   * Deterministic pseudo-embedding for development/testing.
   * Uses character frequency + position-weighted hashing to create
   * a stable vector that similar texts will produce similar vectors.
   *
   * This is NOT a real embedding — it's a placeholder that allows
   * the full pipeline to be tested before connecting a real model.
   */
  private generatePseudoEmbedding(text: string): number[] {
    const embedding = new Array(this.DIMENSIONS).fill(0);

    // Character frequency component
    const charFrequencies = new Map<string, number>();
    for (const char of text.toLowerCase()) {
      charFrequencies.set(char, (charFrequencies.get(char) || 0) + 1);
    }

    for (const [char, count] of charFrequencies) {
      const hash = this.hashString(char + text.length);
      const index = hash % this.DIMENSIONS;
      embedding[index] += count / text.length;
    }

    // Position-weighted component for word-level features
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      const wordHash = this.hashString(words[i]);
      const index = wordHash % this.DIMENSIONS;
      // Weight words earlier in the text more heavily
      const weight = 1 / (1 + i * 0.1);
      embedding[index] += weight;
    }

    // Normalize to unit vector
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0),
    );
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}
