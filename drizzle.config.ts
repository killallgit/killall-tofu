import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/main/database/drizzle/schema/*.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL || './killall-tofu.db',
  },
  verbose: true,
  strict: true,
});