import { defineConfig } from 'orval';

/**
 * Menghasilkan tipe TypeScript dari OpenAPI yang diekspor API.
 * Jalankan `pnpm --filter @ebisnis/api start` lalu `pnpm --filter @ebisnis/web api:generate`,
 * atau arahkan `input.target` ke berkas `docs/api/openapi.json` yang sudah diekspor.
 */
export default defineConfig({
  ebisnis: {
    input: {
      target: process.env.OPENAPI_TARGET ?? '../../docs/api/openapi.json',
    },
    output: {
      mode: 'split',
      target: './src/api/generated/ebisnis.ts',
      schemas: './src/api/generated/model',
      client: 'react-query',
      prettier: false,
      override: {
        mutator: { path: './src/lib/api.ts', name: 'apiRequest' },
        query: { useQuery: true, signal: true },
      },
    },
  },
});
