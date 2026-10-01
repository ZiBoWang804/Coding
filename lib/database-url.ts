const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalDatabaseHost(hostname: string) {
  return LOCAL_HOSTS.has(hostname.replace(/^\[|\]$/g, "").toLowerCase());
}

export function isServerlessRuntime() {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_EXECUTION_ENV ||
      process.env.FUNCTIONS_WORKER_RUNTIME ||
      process.env.FC_FUNCTION_NAME ||
      process.env.ALIYUN_FC_FUNCTION_NAME
  );
}

function isPoolerHost(hostname: string, port: string, params: URLSearchParams) {
  const host = hostname.toLowerCase();
  if (params.get("pgbouncer") === "true") return true;
  if (port === "6543") return true;
  if (host.includes("-pooler.")) return true;
  if (host.includes("pooler.supabase.")) return true;
  if (host.includes(".pooler.")) return true;
  return false;
}

function stripChannelBinding(params: URLSearchParams) {
  if (params.get("channel_binding") === "require") {
    params.delete("channel_binding");
  }
}

function ensureCloudSsl(parsed: URL) {
  if (!isLocalDatabaseHost(parsed.hostname) && !parsed.searchParams.has("sslmode")) {
    parsed.searchParams.set("sslmode", "require");
  }
}

export function normalizeDatabaseUrl(databaseUrl?: string) {
  if (!databaseUrl) return undefined;

  try {
    const parsed = new URL(databaseUrl);
    stripChannelBinding(parsed.searchParams);
    ensureCloudSsl(parsed);

    if (isPoolerHost(parsed.hostname, parsed.port, parsed.searchParams) && !parsed.searchParams.has("pgbouncer")) {
      parsed.searchParams.set("pgbouncer", "true");
    }

    if (
      isServerlessRuntime() &&
      !isLocalDatabaseHost(parsed.hostname) &&
      !parsed.searchParams.has("connection_limit")
    ) {
      parsed.searchParams.set("connection_limit", "1");
    }

    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

export function normalizeDirectUrl(directUrl?: string) {
  if (!directUrl) return undefined;

  try {
    const parsed = new URL(directUrl);
    stripChannelBinding(parsed.searchParams);
    ensureCloudSsl(parsed);
    return parsed.toString();
  } catch {
    return directUrl;
  }
}

export function deriveDirectUrl(databaseUrl: string) {
  try {
    const parsed = new URL(databaseUrl);
    stripChannelBinding(parsed.searchParams);
    parsed.searchParams.delete("pgbouncer");
    parsed.searchParams.delete("connection_limit");

    const host = parsed.hostname.toLowerCase();
    const username = decodeURIComponent(parsed.username);

    if (host.includes("pooler.supabase.") && username.startsWith("postgres.")) {
      const projectRef = username.slice("postgres.".length);
      if (projectRef) {
        parsed.username = "postgres";
        parsed.hostname = `db.${projectRef}.supabase.co`;
        parsed.port = "5432";
      }
    } else if (host.includes("-pooler.")) {
      parsed.hostname = parsed.hostname.replace("-pooler.", ".");
    } else if (parsed.port === "6543") {
      parsed.port = "5432";
    }

    ensureCloudSsl(parsed);
    return parsed.toString();
  } catch {
    return databaseUrl;
  }
}

export function databaseHost(databaseUrl?: string) {
  if (!databaseUrl) return "";
  try {
    return new URL(databaseUrl).host;
  } catch {
    return "";
  }
}
