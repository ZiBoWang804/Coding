import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr,1.05fr] lg:px-8">
      <div className="rounded-[2rem] bg-brand-900 p-8 text-white shadow-card">
        <div className="text-sm tracking-[0.24em] text-white/60">注册</div>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">注册一个账号，开始沉淀你的乡旅偏好和社区内容。</h1>
        <p className="mt-4 text-sm leading-7 text-white/75">登录后可收藏景点、记录打卡、发布攻略、提交新打卡点，并同步到管理员审核后台。</p>
        <div className="mt-8 text-sm text-white/70">已经有账号？ <Link href="/login" className="text-amberleaf">去登录</Link></div>
      </div>
      <AuthForm mode="register" />
    </div>
  );
}
