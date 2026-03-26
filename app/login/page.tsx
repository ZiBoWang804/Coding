import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr,1.05fr] lg:px-8">
      <div className="rounded-[2rem] bg-brand-900 p-8 text-white shadow-card">
        <div className="text-sm tracking-[0.24em] text-white/60">用户登录</div>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">
          登录后，收藏、打卡、搜索记录和个性化推荐才会真正连起来。
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/75">
          这是面向普通用户的登录入口。登录后可以保存你的周末偏好、查看历史浏览、收藏喜欢的景点，并继续使用智能规划和社区功能。
        </p>
        <div className="mt-8 space-y-3 text-sm text-white/72">
          <div>
            还没有账号？
            <Link href="/register" className="ml-2 text-amberleaf">
              去注册
            </Link>
          </div>
          <div>
            如果你要进入后台，请使用
            <Link href="/admin/login" className="ml-2 text-amberleaf">
              管理员登录
            </Link>
          </div>
        </div>
      </div>
      <AuthForm mode="login" portal="user" />
    </div>
  );
}
