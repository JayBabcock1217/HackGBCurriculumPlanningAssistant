import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { Teacher } from '../teacher/teacher.entity';
import { CurriculumChunk } from './curriculum-chunk.entity';

@Entity('curricula')
export class Curriculum {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  subject: string;

  @Column({ nullable: true })
  gradeLevel: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ['pdf', 'word', 'google_docs', 'text'] })
  fileType: 'pdf' | 'word' | 'google_docs' | 'text';

  @Column()
  fileName: string;

  @Column({ nullable: true })
  fileUrl: string;

  @Column({ type: 'int', default: 0 })
  chunkCount: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Teacher, (teacher) => teacher.curricula, {
    onDelete: 'CASCADE',
  })
  teacher: Teacher;

  @OneToMany(() => CurriculumChunk, (chunk) => chunk.curriculum, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  chunks: CurriculumChunk[];
}
