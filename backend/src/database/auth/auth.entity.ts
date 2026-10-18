import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Teacher } from '../teacher/teacher.entity';

export interface RefreshToken {
  token: string;
  expiresAt: string;
}

/**
 * AuthUser (Chunk 11)
 *
 * One row per login. Teachers are the primary users of the app; admin is a
 * school-wide role (view all teachers/students, manage accounts). A single
 * `teacherId` FK keeps the two roles in one table without duplicating data:
 * an admin row links to their own teacher profile for convenience.
 */
@Entity('auth_users')
export class AuthUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  passwordHash: string;

  @Column({ default: 'teacher' })
  role: 'teacher' | 'admin';

  @Column({ nullable: true })
  teacherId: string;

  @Column({ type: 'jsonb', nullable: true })
  refreshTokens: RefreshToken[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
