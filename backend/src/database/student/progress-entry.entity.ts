import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';
import { Student } from './student.entity';

@Entity('progress_entries')
export class ProgressEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['reading', 'math', 'writing', 'science', 'social_studies', 'other'] })
  skillArea: string;

  @Column()
  skillName: string;

  @Column({ type: 'float' })
  score: number;

  @Column({ type: 'float', nullable: true })
  maxScore: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Student, (student) => student.progressEntries, {
    onDelete: 'CASCADE',
  })
  student: Student;
}
