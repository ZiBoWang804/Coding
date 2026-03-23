"use client";

import { useState } from "react";

const emptyForm = {
  name: "",
  province: "",
  city: "",
  district: "",
  address: "",
  description: "",
  tags: "",
  suggestedDuration: "",
  transportInfo: "",
  imageUrl: "",
  contactName: "",
  contactPhone: "",
  reason: ""
};

export function SpotSubmissionForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState("");

  async function submit() {
    const response = await fetch("/api/submissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        tags: form.tags.split(/[|,，、]/).map((item) => item.trim()).filter(Boolean)
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "提交失败");
      return;
    }

    setForm(emptyForm);
    setMessage("已提交审核，管理员通过后会进入正式景点库");
    onSubmitted?.();
  }

  return (
    <section className="rounded-[1.8rem] border border-brand-100 bg-white p-5 shadow-card">
      <h3 className="text-lg font-semibold text-brand-900">提交新的打卡点</h3>
      <p className="mt-1 text-sm text-slate-500">用户可补充新的村镇或打卡点，后台审核通过后自动入库。</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {[
          ["name", "名称"],
          ["province", "省份"],
          ["city", "城市"],
          ["district", "区县"],
          ["address", "地址"],
          ["suggestedDuration", "建议时长"],
          ["transportInfo", "交通提示"],
          ["imageUrl", "图片链接"],
          ["contactName", "联系人"],
          ["contactPhone", "联系电话"]
        ].map(([key, label]) => (
          <label key={key} className="space-y-2 text-sm">
            <span>{label}</span>
            <input value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="w-full rounded-2xl border border-brand-100 px-4 py-3" />
          </label>
        ))}
      </div>
      <label className="mt-3 block space-y-2 text-sm">
        <span>标签</span>
        <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="如 自驾|亲子|露营" className="w-full rounded-2xl border border-brand-100 px-4 py-3" />
      </label>
      <label className="mt-3 block space-y-2 text-sm">
        <span>简介</span>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="min-h-28 w-full rounded-2xl border border-brand-100 px-4 py-3" />
      </label>
      <label className="mt-3 block space-y-2 text-sm">
        <span>推荐理由</span>
        <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="min-h-24 w-full rounded-2xl border border-brand-100 px-4 py-3" />
      </label>
      <button type="button" onClick={() => void submit()} className="mt-4 rounded-full bg-brand-700 px-5 py-3 text-sm text-white">提交审核</button>
      {message ? <p className="mt-3 text-sm text-slate-500">{message}</p> : null}
    </section>
  );
}