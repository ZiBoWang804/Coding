"use client";

import { useMemo, useState } from "react";

type PreviewResponse = {
  totalRows: number;
  previewRows: Record<string, unknown>[];
  normalizedRows: Record<string, unknown>[];
  errors: Array<{ row: number; message: string }>;
  mapping: Record<string, string>;
};

const TARGET_FIELDS = [
  "name",
  "province",
  "city",
  "district",
  "address",
  "description",
  "tags",
  "rating",
  "crowdLevel",
  "avgCost",
  "suggestedDuration",
  "bestSeason",
  "transportInfo",
  "latitude",
  "longitude",
  "imageUrl",
  "ticketBookingUrl",
  "hotelBookingUrl",
  "gaodeNavigationUrl",
  "isNationalKeyVillage",
  "batch",
  "source",
  "accommodationTips",
  "diningTips",
  "routeHighlights"
] as const;

export function ImportWorkbench() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [message, setMessage] = useState("");

  const canPreview = useMemo(() => rows.length > 0, [rows.length]);

  async function readFile(file: File) {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/preview", {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "读取文件失败");
        return;
      }

      setHeaders(data.headers || []);
      setRows(data.rows || []);
      setMapping(data.mapping || {});
      setPreview(null);
      setMessage(`已读取 ${data.rows?.length || 0} 行数据，下一步可以检查字段映射。`);
    } catch {
      setMessage("读取文件失败，请重试。");
    }
  }

  async function generatePreview() {
    try {
      const response = await fetch("/api/import/preview", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mapping, source: "admin_import" })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "生成预览失败");
        return;
      }
      setPreview(data);
      setMessage("导入预览已生成，请确认后再提交。");
    } catch {
      setMessage("生成预览失败，请稍后再试。");
    }
  }

  async function commit() {
    if (!preview) return;

    try {
      const response = await fetch("/api/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          mapping,
          source: "admin_import"
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || "导入失败");
        return;
      }

      setMessage(`导入完成：新增 ${data.created ?? 0} 条，更新 ${data.updated ?? 0} 条，失败 ${(data.failed || []).length} 条。`);
    } catch {
      setMessage("导入失败，请稍后再试。");
    }
  }

  const previewColumns = Object.keys(preview?.previewRows[0] || {});

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-brand-900">CSV / XLSX 导入</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">
          先上传景点数据文件并检查字段映射，再生成导入预览。正式提交前会先做格式校验，便于协同开发时追踪导入结果。
        </p>

        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          className="mt-4 block w-full text-sm"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void readFile(file);
            }
          }}
        />

        {message ? <p className="mt-3 text-sm text-slate-500">{message}</p> : null}
      </section>

      {headers.length > 0 ? (
        <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-brand-900">字段映射</h3>
              <p className="mt-1 text-sm text-slate-500">把文件列名映射到系统字段，未映射字段不会进入导入结果。</p>
            </div>
            <div className="text-xs text-slate-500">源文件列数：{headers.length}</div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {TARGET_FIELDS.map((field) => (
              <label key={field} className="space-y-2 text-sm">
                <span className="font-medium text-slate-700">{field}</span>
                <select
                  className="w-full rounded-2xl border border-brand-100 px-4 py-3 outline-none transition focus:border-brand-400"
                  value={mapping[field] || ""}
                  onChange={(event) => setMapping((current) => ({ ...current, [field]: event.target.value }))}
                >
                  <option value="">不导入</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={!canPreview}
              onClick={() => void generatePreview()}
              className="rounded-full bg-brand-700 px-5 py-3 text-sm text-white disabled:opacity-60"
            >
              生成预览
            </button>
            <button
              type="button"
              disabled={!preview}
              onClick={() => void commit()}
              className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700 disabled:opacity-60"
            >
              确认导入
            </button>
          </div>
        </section>
      ) : null}

      {preview ? (
        <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-brand-900">导入预览</h3>
              <p className="mt-1 text-sm text-slate-500">总行数：{preview.totalRows}。这里只展示前 5 行映射结果。</p>
            </div>
            <div className="rounded-full bg-brand-50 px-4 py-2 text-xs text-brand-700">
              校验错误：{preview.errors.length}
            </div>
          </div>

          {preview.errors.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {preview.errors.slice(0, 8).map((error) => (
                <div key={`${error.row}-${error.message}`}>
                  第 {error.row} 行：{error.message}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100">
                  {previewColumns.map((key) => (
                    <th key={key} className="px-3 py-2 font-medium text-slate-700">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((row, index) => (
                  <tr key={index} className="border-b border-brand-50 align-top">
                    {previewColumns.map((key) => (
                      <td key={key} className="px-3 py-2 text-slate-600">
                        {String(row[key] ?? "")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
