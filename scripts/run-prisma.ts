import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { databaseHost, deriveDirectUrl, normalizeDatabaseUrl, normalizeDirectUrl } from "@/lib/database-url";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function prepareDatabaseEnv(command: string) {
  loadEnvFile(path.resolve(".env"));
  loadEnvFile(path.resolve(".env.local"));

  const generateOnly = command === "generate";
  if (!process.env.DATABASE_URL) {
    if (!generateOnly) {
      console.error("缺少 DATABASE_URL。请先在 .env 里填云数据库连接串，演示模式不需要执行这一步。");
      process.exit(1);
    }

    process.env.DATABASE_URL = "postgresql://postgres:password@localhost:5432/youxiangji?schema=public";
  }

  const derivedDirectUrl = !process.env.DIRECT_URL;
  if (derivedDirectUrl) {
    process.env.DIRECT_URL = deriveDirectUrl(process.env.DATABASE_URL);
    if (!generateOnly) {
      console.log(
        `DIRECT_URL 未设置，已按 DATABASE_URL 推导直连地址（${databaseHost(process.env.DIRECT_URL)}）。迁移失败时请在 .env 里显式填写供应商给出的直连串。`
      );
    }
  }

  process.env.DATABASE_URL = normalizeDatabaseUrl(process.env.DATABASE_URL) ?? process.env.DATABASE_URL;
  process.env.DIRECT_URL = normalizeDirectUrl(process.env.DIRECT_URL) ?? process.env.DIRECT_URL;
}

function main() {
  const args = process.argv.slice(2);
  if (!args.length) {
    console.error("用法: tsx scripts/run-prisma.ts <prisma 参数>，例如 generate 或 migrate deploy");
    process.exit(1);
  }

  prepareDatabaseEnv(args[0]);

  const child = spawn("prisma", args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exit(code ?? 1);
  });
}

main();
