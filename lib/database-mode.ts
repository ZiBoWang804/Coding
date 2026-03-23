export function isDemoDataEnabled() {
  return process.env.USE_DEMO_DATA === "true";
}

export function isDatabaseEnabled() {
  return Boolean(process.env.DATABASE_URL) && !isDemoDataEnabled();
}
