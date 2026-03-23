"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "", nickname: "", homeCity: "" });
  const [message, setMessage] = useState("");
  const redirect = searchParams.get("redirect") || "/me";

  async function submit() {
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(mode === "login" ? { email: form.email, password: form.password } : form)
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || (mode === "login" ? "登录失败" : "注册失败"));
      return;
    }
    router.push(redirect);
    router.refresh();
  }

  return (
    <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
      <h1 className="text-3xl font-semibold text-brand-900">{mode === "login" ? "用户登录" : "注册账号"}</h1>
      <p className="mt-2 text-sm text-slate-600">登录后可保存偏好、搜索历史、打卡记录和社区内容。</p>
      <div className="mt-6 grid gap-4">
        {mode === "register" ? (
          <label className="space-y-2 text-sm">
            <span>昵称</span>
            <input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="w-full rounded-2xl border border-brand-100 px-4 py-3" />
          </label>
        ) : null}
        <label className="space-y-2 text-sm">
          <span>邮箱</span>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-2xl border border-brand-100 px-4 py-3" />
        </label>
        <label className="space-y-2 text-sm">
          <span>密码</span>
          <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-2xl border border-brand-100 px-4 py-3" />
        </label>
        {mode === "register" ? (
          <label className="space-y-2 text-sm">
            <span>常住城市</span>
            <input value={form.homeCity} onChange={(e) => setForm({ ...form, homeCity: e.target.value })} className="w-full rounded-2xl border border-brand-100 px-4 py-3" />
          </label>
        ) : null}
      </div>
      <button type="button" onClick={() => void submit()} className="mt-6 w-full rounded-2xl bg-brand-700 px-5 py-3 text-sm text-white">{mode === "login" ? "登录" : "注册并进入个人中心"}</button>
      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
    </div>
  );
}