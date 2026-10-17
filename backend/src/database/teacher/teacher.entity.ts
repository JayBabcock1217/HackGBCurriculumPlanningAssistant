import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Curriculum } from '../curriculum/curriculum.entity';
import { Student } from '../student/student.entity';

@Entity('teachers')
export class Teacher {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column({ nullable: true })
  schoolName: string;

  @Column({ nullable: true })
  gradeLevel: string;

  @Column({ nullable: true })
  subject: string;

  @Column({ type: 'enum', enum: ['en', 'es', 'fr', 'de', 'zh', 'ar', 'hi', 'pt', 'ru', 'ja'], default: 'en' })
  language: string;

  @Column({ type: 'enum', enum: ['teacher', 'admin'], default: 'teacher' })
  role: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => Curriculum, (curriculum) => curriculum.teacher)
  curricula: Curriculum[];

  @OneToMany(() => Student, (student) => student.teacher)
  students: Student[];
}
