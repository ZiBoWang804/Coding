"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type AuthFormProps = {
  mode: "login" | "register";
  portal?: "user" | "admin";
};

export function AuthForm({ mode, portal = "user" }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: "", password: "", nickname: "", homeCity: "" });
  const [message, setMessage] = useState("");
  const defaultRedirect = portal === "admin" ? "/admin" : "/me";
  const redirect = searchParams.get("redirect") || defaultRedirect;

  async function submit() {
    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      mode === "login"
        ? {
            email: form.email,
            password: form.password,
            expectedRole: portal === "admin" ? "ADMIN" : "USER"
          }
        : form;

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

    router.push(redirect);
    router.refresh();
  }

  const title =
    mode === "register" ? "注册普通用户账号" : portal === "admin" ? "管理员登录" : "用户登录";
  const description =
    mode === "register"
      ? "注册后可以保存偏好、收藏景点、记录打卡，并获得更贴合你的路线建议。"
      : portal === "admin"
        ? "仅限后台管理员登录，用于审核投稿、维护景点数据和管理平台内容。"
        : "登录后可以保存偏好、查看收藏、记录打卡，并获得更贴合你的路线推荐。";
  const buttonLabel =
    mode === "register" ? "注册并进入个人中心" : portal === "admin" ? "进入管理员后台" : "登录";

  return (
    <div className="rounded-[2rem] border border-brand-100 bg-white p-6 shadow-card">
      <h1 className="text-3xl font-semibold text-brand-900">{title}</h1>
      <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>

      <div className="mt-6 grid gap-4">
        {mode === "register" ? (
          <label className="space-y-2 text-sm">
            <span>昵称</span>
            <input
              value={form.nickname}
              onChange={(event) => setForm({ ...form, nickname: event.target.value })}
              className="w-full rounded-2xl border border-brand-100 px-4 py-3"
            />
          </label>
        ) : null}

        <label className="space-y-2 text-sm">
          <span>邮箱</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            className="w-full rounded-2xl border border-brand-100 px-4 py-3"
          />
        </label>

        <label className="space-y-2 text-sm">
          <span>密码</span>
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            className="w-full rounded-2xl border border-brand-100 px-4 py-3"
          />
        </label>

        {mode === "register" ? (
          <label className="space-y-2 text-sm">
            <span>常住城市</span>
            <input
              value={form.homeCity}
              onChange={(event) => setForm({ ...form, homeCity: event.target.value })}
              className="w-full rounded-2xl border border-brand-100 px-4 py-3"
            />
          </label>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void submit()}
        className="mt-6 w-full rounded-2xl bg-brand-700 px-5 py-3 text-sm font-medium text-white"
      >
        {buttonLabel}
      </button>

      {message ? <p className="mt-3 text-sm text-red-600">{message}</p> : null}
    </div>
  );
}
