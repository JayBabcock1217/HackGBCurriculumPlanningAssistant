import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToOne,
} from 'typeorm';
import { Student } from '../student/student.entity';
import { Curriculum } from '../curriculum/curriculum.entity';
import { Feedback } from '../feedback/feedback.entity';

@Entity('suggestions')
export class Suggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['lesson_plan', 'activity', 'assessment', 'intervention', 'resource'] })
  type: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', nullable: true })
  title: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown>;

  @Column({ type: 'enum', enum: ['pending', 'generating', 'accepted', 'modified', 'rejected', 'archived', 'failed'], default: 'pending' })
  status: string;

  @Column({ type: 'text', nullable: true })
  modelUsed?: string;

  /**
   * Chunk 12: the auth user that triggered this (background) generation.
   * Used for ownership checks on the status endpoint. Null for suggestions
   * created directly via the CRUD endpoint or before auth existed.
   */
  @Column({ type: 'uuid', nullable: true })
  ownerId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Student, (student) => student.id, {
    onDelete: 'CASCADE',
  })
  student: Student;

  @ManyToOne(() => Curriculum, (curriculum) => curriculum.id, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  curriculum: Curriculum;

  @OneToOne(() => Feedback, (feedback) => feedback.suggestion, {
    cascade: true,
  })
  feedback: Feedback;
}
