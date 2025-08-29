#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const KILLALL_DIR = path.join(os.homedir(), '.killall');

console.log('🧹 Cleaning killall database and directory...');

try {
  if (fs.existsSync(KILLALL_DIR)) {
    console.log(`Removing directory: ${KILLALL_DIR}`);
    fs.rmSync(KILLALL_DIR, { recursive: true, force: true });
    console.log('✅ Killall directory cleaned successfully');
  } else {
    console.log('ℹ️  Killall directory does not exist, nothing to clean');
  }
} catch (error) {
  console.error('❌ Failed to clean killall directory:', error.message);
  process.exit(1);
}

console.log('🎉 Database cleanup complete!');