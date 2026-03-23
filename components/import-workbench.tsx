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
];

export function ImportWorkbench() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [message, setMessage] = useState("");

  const canPreview = useMemo(() => rows.length > 0, [rows.length]);

  async function readFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/import/preview", { method: "POST", body: formData });
    const data = await response.json();
    setHeaders(data.headers || []);
    setRows(data.rows || []);
    setMapping(data.mapping || {});
    setPreview(null);
    setMessage(`已读取 ${data.rows?.length || 0} 行，下一步可调整字段映射。`);
  }

  async function generatePreview() {
    const response = await fetch("/api/import/preview", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, mapping })
    });
    const data = await response.json();
    setPreview(data);
  }

  async function commit() {
    if (!preview) return;
    const response = await fetch("/api/import/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows, mapping, source: "admin_import" })
    });
    const data = await response.json();
    setMessage(`导入完成：新增 ${data.created ?? 0}，更新 ${data.updated ?? 0}，失败 ${(data.failed || []).length}`);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-card">
        <h2 className="text-xl font-semibold text-brand-900">CSV / XLSX 导入</h2>
        <p className="mt-2 text-sm text-slate-600">先上传文件读取表头，再调整字段映射并生成导入预览。</p>
        <input type="file" accept=".csv,.xlsx,.xls" className="mt-4 block w-full text-sm" onChange={(e) => { const file = e.target.files?.[0]; if (file) void readFile(file); }} />
        {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      </section>

      {headers.length > 0 ? (
        <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-card">
          <h3 className="text-lg font-semibold text-brand-900">字段映射</h3>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {TARGET_FIELDS.map((field) => (
              <label key={field} className="space-y-2 text-sm">
                <span>{field}</span>
                <select className="w-full rounded-2xl border border-brand-100 px-4 py-3" value={mapping[field] || ""} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}>
                  <option value="">未映射</option>
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </select>
              </label>
            ))}
          </div>
          <div className="mt-5 flex gap-3">
            <button type="button" disabled={!canPreview} onClick={generatePreview} className="rounded-full bg-brand-700 px-5 py-3 text-sm text-white">生成预览</button>
            <button type="button" disabled={!preview} onClick={commit} className="rounded-full border border-brand-200 px-5 py-3 text-sm text-brand-700">确认导入</button>
          </div>
        </section>
      ) : null}

      {preview ? (
        <section className="rounded-3xl border border-brand-100 bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-brand-900">导入预览</h3>
            <div className="text-sm text-slate-500">总行数 {preview.totalRows}</div>
          </div>
          {preview.errors.length > 0 ? (
            <div className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
              {preview.errors.slice(0, 5).map((error) => <div key={`${error.row}-${error.message}`}>第 {error.row} 行：{error.message}</div>)}
            </div>
          ) : null}
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brand-100">
                  {Object.keys(preview.previewRows[0] || {}).map((key) => <th key={key} className="px-3 py-2 font-medium">{key}</th>)}
                </tr>
              </thead>
              <tbody>
                {preview.previewRows.map((row, index) => (
                  <tr key={index} className="border-b border-brand-50">
                    {Object.keys(preview.previewRows[0] || {}).map((key) => <td key={key} className="px-3 py-2 text-slate-600">{String(row[key] ?? "")}</td>)}
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