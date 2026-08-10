import fs from 'fs';
import path from 'path';
import pool from './db';

async function runSeed() {
  console.log('🌱 Starting database seeding...');
  try {
    const seedPath = path.resolve(__dirname, '../../database/seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');

    const client = await pool.connect();
    try {
      console.log('Executing seed SQL script...');
      await client.query(sql);
      console.log('✅ Database seeded successfully!');
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('❌ Error seeding database:', error.message);
  } finally {
    await pool.end();
  }
}

runSeed();
