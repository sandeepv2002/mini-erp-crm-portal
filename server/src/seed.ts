import fs from 'fs';
import path from 'path';
import { query } from './db';

async function runSeed() {
  console.log('🌱 Starting database seeding...');
  try {
    const seedPath = path.resolve(__dirname, '../../database/setup_and_seed.sql');
    const sql = fs.readFileSync(seedPath, 'utf8');

    console.log('Executing seed SQL script...');
    await query(sql);
    console.log('✅ Database seeded successfully!');
  } catch (error: any) {
    console.error('❌ Error seeding database:', error.message);
  }
}

runSeed();
