// Server-only environment access. Throws early with a clear message instead of
// failing later with `undefined` deep inside a client call.
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
