import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma CLI does not read .env.local (that's a Next.js convention),
// so load it explicitly here to keep one source of truth for env vars.
loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
