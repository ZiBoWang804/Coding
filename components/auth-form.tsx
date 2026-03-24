"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type AuthEntry = "user" | "admin";

export function AuthForm({
  mode,
  entry = "user"
}: {
  mode: "login" | "register";
  entry?: AuthEntry;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "", nickname: "", homeCity: "" });
  const [message, setMessage] = useState("");
  const redirect =
    searchParams.get("redirect") ||
    (mode === "login" ? (entry === "admin" ? "/admin" : "/me") : "/me");

  const isAdminEntry = entry === "admin";
  const title =
    mode === "login" ? (isAdminEntry ? "管理员登录" : "普通用户登录") : "注册普通用户账号";
  const description =
    mode === "login"
      ? isAdminEntry
        ? "用于进入管理员后台，处理景点数据、内容审核和平台监控。"
        : "登录后可保存偏好、搜索记录、打卡内容和社区互动。"
      : "注册后即可收藏景点、记录打卡、发布攻略并进入个人中心。";

  async function submit() {
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      mode === "login"
        ? { email: form.email, password: form.password, entry }
        : {
            ...form,
            homeCity: form.homeCity.trim() || null
          };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(data.error || (mode === "login" ? "登录失败" : "注册失败"));
        return;
      }

      router.replace(redirect);
      router.refresh();
    } catch {
      setMessage(mode === "login" ? "登录请求失败，请稍后再试" : "注册请求失败，请稍后再试");
    }
  }

  return (
    <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs ${isAdminEntry ? "bg-brand-900 text-white" : "bg-brand-50 text-brand-700"}`}>
          {isAdminEntry ? "管理员入口" : "用户入口"}
        </span>
        {mode === "register" ? (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">仅面向普通用户</span>
        ) : null}
      </div>

      <h1 className="mt-4 text-3xl font-semibold text-brand-900">{title}</h1>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>

      {isAdminEntry && mode === "login" ? (
        <div className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-xs leading-6 text-brand-700">
          本地演示模式下，邮箱中包含 <code>admin</code> 即可进入管理员后台；正式环境建议只使用已开通的管理员账号登录。
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {mode === "register" ? (
          <label className="space-y-2 text-sm">
            <span>昵称</span>
            <input
              value={form.nickname}
              onChange={(event) => setForm({ ...form, nickname: event.target.value })}
              className="w-full rounded-2xl border border-brand-100 px-4 py-3 outline-none transition focus:border-brand-400"
            />
          </label>
        ) : null}

        <label className="space-y-2 text-sm">
          <span>{isAdminEntry && mode === "login" ? "管理员邮箱" : "邮箱"}</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="w-full rounded-2xl border border-brand-100 px-4 py-3 outline-none transition focus:border-brand-400"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span>密码</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className="w-full rounded-2xl border border-brand-100 px-4 py-3 outline-none transition focus:border-brand-400"
          />
        </label>

        {mode === "register" ? (
          <label className="space-y-2 text-sm">
            <span>常住城市</span>
            <input
              value={form.homeCity}
              onChange={(event) => setForm({ ...form, homeCity: event.target.value })}
              className="w-full rounded-2xl border border-brand-100 px-4 py-3 outline-none transition focus:border-brand-400"
            />
          </label>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void submit()}
        className="mt-6 w-full rounded-2xl bg-brand-700 px-5 py-3 text-sm text-white"
      >
        {mode === "login" ? (isAdminEntry ? "登录并进入后台" : "登录并进入用户中心") : "注册并进入用户中心"}
      </button>

      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
