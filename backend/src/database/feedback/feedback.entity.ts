import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Suggestion } from '../suggestion/suggestion.entity';
import { Teacher } from '../teacher/teacher.entity';

@Entity('feedback')
export class Feedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['accepted', 'modified', 'rejected'] })
  action: 'accepted' | 'modified' | 'rejected';

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  teacherComment: string;

  // If the teacher modified the suggestion, store the modified version
  @Column({ type: 'text', nullable: true })
  modifiedContent: string;

  // Embedding of the feedback text for similarity-based retrieval
  @Column({ type: 'text', nullable: true })
  embedding: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Suggestion, (suggestion) => suggestion.feedback, {
    onDelete: 'CASCADE',
  })
  suggestion: Suggestion;

  @ManyToOne(() => Teacher, (teacher) => teacher.id, {
    onDelete: 'CASCADE',
  })
  teacher: Teacher;
}
