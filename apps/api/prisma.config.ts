import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/platform',
  migrations: {
    path: 'prisma/platform/migrations',
    seed: 'ts-node -P tsconfig.json prisma/seed.ts',
  },
});

