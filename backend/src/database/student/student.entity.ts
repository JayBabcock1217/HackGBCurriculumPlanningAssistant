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
import { ProgressEntry } from './progress-entry.entity';

export interface IepDetails {
  planType: 'IEP' | '504';
  accommodations: string[];
  goals: string[];
  lastReviewed?: string;
  notes?: string;
}

export interface EllStatus {
  homeLanguage: string;
  englishProficiency: 'beginner' | 'intermediate' | 'advanced' | 'fluent';
  ellStartDate?: string;
  notes?: string;
}

export interface LearningDifference {
  type: string;
  diagnosed: boolean;
  notes?: string;
}

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  gradeLevel: string;

  // Academic metrics
  @Column({ type: 'float', nullable: true })
  readingLevel: number;

  @Column({ type: 'float', nullable: true })
  mathAbility: number;

  @Column({ type: 'jsonb', nullable: true })
  skills: string[];

  // Multi-modal tracking
  @Column({ type: 'jsonb', nullable: true })
  iepDetails: IepDetails;

  @Column({ type: 'jsonb', nullable: true })
  ellStatus: EllStatus;

  @Column({ type: 'jsonb', nullable: true })
  learningDifferences: LearningDifference[];

  @Column({ type: 'text', nullable: true })
  socialEmotionalNotes: string;

  @Column({ type: 'text', nullable: true })
  teacherNotes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => Teacher, (teacher) => teacher.students, {
    onDelete: 'CASCADE',
  })
  teacher: Teacher;

  @OneToMany(() => ProgressEntry, (entry) => entry.student, {
    cascade: true,
    onDelete: 'CASCADE',
  })
  progressEntries: ProgressEntry[];
}
