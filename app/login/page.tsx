import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr,1.05fr] lg:px-8">
      <div className="rounded-[2rem] bg-brand-900 p-8 text-white shadow-card">
        <div className="text-sm tracking-[0.24em] text-white/60">登录</div>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">登录后，个性化推荐和社区功能才会真正工作起来。</h1>
        <p className="mt-4 text-sm leading-7 text-white/75">系统会记录你的偏好标签、搜索历史、打卡记录和帖子互动，用于后续更精准的乡旅推荐。</p>
        <div className="mt-8 text-sm text-white/70">还没有账号？ <Link href="/register" className="text-amberleaf">去注册</Link></div>
      </div>
      <AuthForm mode="login" />
    </div>
  );
}
