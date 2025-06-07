declare module '../db/migration.js' {
  export function migrateLocalStorageToSupabase(): Promise<{
    success: boolean;
    message: string;
    error?: any;
  }>;
}
