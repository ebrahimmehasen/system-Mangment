/**
 * Centralised, typed access to environment variables.
 * Server-only secrets are read lazily so they never leak into the client bundle.
 */

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export const serverEnv = {
  get supabaseServiceRoleKey(): string {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
  get databaseUrl(): string {
    return required("DATABASE_URL", process.env.DATABASE_URL);
  },
  maxProjectFileSize: Number(process.env.MAX_PROJECT_FILE_SIZE ?? 10485760),
  defaultCurrency: (process.env.DEFAULT_CURRENCY ?? "EGP") as
    | "EGP"
    | "USD"
    | "SAR",
};
