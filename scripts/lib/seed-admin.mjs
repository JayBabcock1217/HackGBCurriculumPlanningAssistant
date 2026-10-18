#!/usr/bin/env node
/**
 * One-time seed: create the initial admin account directly in Postgres.
 *
 * Why a script instead of the /api/auth/register endpoint? The app requires
 * a valid login to call admin routes (chicken-and-egg for the FIRST admin),
 * so we write the account straight into the database with a bcrypt hash.
 * This mirrors how the backend stores auth_users (TypeORM entities), so the
 * account behaves exactly like one created through the UI.
 *
 * Idempotent: if the account already exists it is left untouched.
 *
 * Used by scripts/seed-admin.sh (npm run seed-admin).
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const email = process.env.SEED_ADMIN_EMAIL || 'admin@school.edu';
const password =
  process.env.SEED_ADMIN_PASSWORD || 'hackgb123';
const firstName = process.env.SEED_ADMIN_FIRST_NAME || 'Admin';
const lastName = process.env.SEED_ADMIN_LAST_NAME || 'User';

// DATABASE_URL works both from the host (localhost) and from inside the
// compose network (postgres). Default to the compose-network form.
const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://hackgb:hackgb_dev_password@postgres:5432/hackgb';

const client = new Client({ connectionString: databaseUrl });

async function main() {
  await client.connect();

  // 1. Teacher profile (the admin's own teacher record, for the sidebar).
  const teacher = await client.query(
    `INSERT INTO teachers (email, "firstName", "lastName", role)
     VALUES ($1, $2, $3, 'admin')
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [email, firstName, lastName],
  );
  // If the teacher already existed (no RETURNING row), look it up by email.
  let teacherId = teacher.rows[0]?.id;
  if (!teacherId) {
    const found = await client.query(
      `SELECT id FROM teachers WHERE email = $1`,
      [email],
    );
    teacherId = found.rows[0]?.id;
  }

  // 2. Auth account (idempotent — skip if it already exists).
  const existing = await client.query(
    `SELECT id, role FROM auth_users WHERE email = $1`,
    [email],
  );
  if (existing.rows.length > 0) {
    console.log(`Already exists: ${email} (role=${existing.rows[0].role}) — nothing to do.`);
    await client.end();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const created = await client.query(
    `INSERT INTO auth_users (email, "passwordHash", role, "teacherId", "refreshTokens")
     VALUES ($1, $2, 'admin', $3, '[]')
     RETURNING id, email, role`,
    [email, passwordHash, teacherId],
  );

  console.log('Created admin account:');
  console.log(`  email:    ${created.rows[0].email}`);
  console.log(`  password: ${password}`);
  console.log(`  role:     ${created.rows[0].role}`);
  console.log('Log in at the frontend login page.');
  await client.end();
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  try {
    client.end();
  } catch {}
  process.exit(1);
});
