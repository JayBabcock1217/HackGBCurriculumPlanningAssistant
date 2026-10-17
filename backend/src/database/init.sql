-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- This script is run by TypeORM's synchronize in dev mode
-- or can be run manually against the database
-- psql -U hackgb -d hackgb -f init.sql
