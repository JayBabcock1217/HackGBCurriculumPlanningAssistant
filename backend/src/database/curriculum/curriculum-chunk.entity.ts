import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Curriculum } from './curriculum.entity';

@Entity('curriculum_chunks')
export class CurriculumChunk {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  content: string;

  @Column()
  chunkIndex: number;

  @Column({ type: 'int' })
  tokenCount: number;

  // Stored as text representation of the vector for pgvector
  // The embedding service handles serialization/deserialization
  @Column({ type: 'text', nullable: true })
  embedding: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Curriculum, (curriculum) => curriculum.chunks, {
    onDelete: 'CASCADE',
  })
  curriculum: Curriculum;
}
