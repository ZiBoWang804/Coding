import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { buildImportPreview, commitImportRows, defaultFieldMapping, loadRowsFromFile } from "@/lib/importer";

const prisma = new PrismaClient();

function getArg(flag: string) {
  const hit = process.argv.find((item) => item.startsWith(`${flag}=`));
  return hit ? hit.slice(flag.length + 1) : undefined;
}

async function main() {
  const fileArg = getArg("--file");
  const source = getArg("--source") ?? "admin_import";
  const batch = getArg("--batch") ?? `cli-import-${new Date().toISOString().slice(0, 10)}`;

  if (!fileArg) {
    throw new Error("请传入 --file=./data/official_list_sample.csv");
  }

  const rows = loadRowsFromFile(path.resolve(process.cwd(), fileArg));
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const preview = buildImportPreview(rows, defaultFieldMapping(headers), { source, batch });

  if (preview.errors.length > 0) {
    console.error(JSON.stringify(preview.errors, null, 2));
    process.exit(1);
  }

  const result = await commitImportRows(prisma, preview.normalizedRows, { source, batch });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
