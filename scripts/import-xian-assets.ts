import fs from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const WORKBOOK_KEYWORD = "重发版";
const IMAGE_FOLDER_KEYWORD = "图片素材包";
const SHEET_NAME = "图片与坐标补充";
const HEADER_ROW_INDEX = 3;
const DATA_START_ROW_INDEX = 4;
const PUBLIC_ASSET_DIR = path.join(process.cwd(), "public", "spot-assets", "xian");

type SheetRecord = Record<string, string | number>;

function findWorkbookPath() {
  const workbook = fs
    .readdirSync(process.cwd())
    .find((name) => name.endsWith(".xlsx") && name.includes(WORKBOOK_KEYWORD));

  if (!workbook) {
    throw new Error("未找到包含“重发版”关键字的 Excel 文件。");
  }

  return path.join(process.cwd(), workbook);
}

function findImageFolderPath() {
  const folder = fs
    .readdirSync(process.cwd(), { withFileTypes: true })
    .find((entry) => entry.isDirectory() && entry.name.includes(IMAGE_FOLDER_KEYWORD));

  if (!folder) {
    throw new Error("未找到景点图片素材包目录。");
  }

  return path.join(process.cwd(), folder.name);
}

function readSheetRecords(workbookPath: string) {
  const workbook = XLSX.readFile(workbookPath);
  const sheet = workbook.Sheets[SHEET_NAME];

  if (!sheet) {
    throw new Error(`未找到工作表：${SHEET_NAME}`);
  }

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });
  const headers = (rows[HEADER_ROW_INDEX] || []).map((item) => String(item).trim());

  return rows
    .slice(DATA_START_ROW_INDEX)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => {
      const record: SheetRecord = {};
      headers.forEach((header, index) => {
        if (header) {
          record[header] = row[index] as string | number;
        }
      });
      return record;
    });
}

function toNumber(value: string | number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildPublicImageName(index: number, sourceFileName: string) {
  const extension = path.extname(sourceFileName).toLowerCase() || ".jpg";
  return `xian-${String(index).padStart(2, "0")}${extension}`;
}

async function main() {
  const workbookPath = findWorkbookPath();
  const imageFolderPath = findImageFolderPath();
  const records = readSheetRecords(workbookPath);

  fs.mkdirSync(PUBLIC_ASSET_DIR, { recursive: true });

  let updated = 0;
  const missingSpots: string[] = [];
  const missingImages: string[] = [];

  for (const record of records) {
    const seq = toNumber(record["序号"]);
    const name = String(record["景点名称"] ?? "").trim();
    const latitude = toNumber(record["WGS84纬度（近似）"]);
    const longitude = toNumber(record["WGS84经度（近似）"]);
    const imageFileName = String(record["图片文件名"] ?? "").trim();

    if (!seq || !name || latitude == null || longitude == null) {
      continue;
    }

    const spot = await prisma.spot.findFirst({ where: { name } });
    if (!spot) {
      missingSpots.push(name);
      continue;
    }

    let imageUrl: string | null = null;
    if (imageFileName) {
      const sourceImagePath = path.join(imageFolderPath, imageFileName);
      if (fs.existsSync(sourceImagePath)) {
        const publicImageName = buildPublicImageName(seq, imageFileName);
        const targetImagePath = path.join(PUBLIC_ASSET_DIR, publicImageName);
        fs.copyFileSync(sourceImagePath, targetImagePath);
        imageUrl = `/spot-assets/xian/${publicImageName}`;
      } else {
        missingImages.push(imageFileName);
      }
    }

    await prisma.spot.update({
      where: { id: spot.id },
      data: {
        latitude,
        longitude,
        imageUrl: imageUrl ?? spot.imageUrl
      }
    });

    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        workbookPath: path.basename(workbookPath),
        imageFolder: path.basename(imageFolderPath),
        updated,
        missingSpots,
        missingImages
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
