// Side-effect module, imported first by main.ts: ES modules evaluate every import before the importer's body,
// and ConfigModule.forRoot(), data-source.ts and @Interval delays read process.env while being imported.
// Values already in the process environment win; a missing .env (production) is fine.
try {
  process.loadEnvFile();
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
