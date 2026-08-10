import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const isCloud = process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/verve_erp',
  ssl: isCloud ? { rejectUnauthorized: false } : undefined,
});

// Helper to run query with parameters
export const query = (text: string, params?: any[]) => pool.query(text, params);

export default pool;
