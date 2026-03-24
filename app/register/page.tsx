import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr,1.05fr] lg:px-8">
      <div className="rounded-[2rem] bg-brand-900 p-8 text-white shadow-card">
        <div className="text-sm tracking-[0.24em] text-white/60">USER REGISTER</div>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">注册普通用户账号，开始沉淀你的乡旅偏好、打卡记录和社区内容。</h1>
        <p className="mt-4 text-sm leading-7 text-white/75">
          普通用户注册后可收藏景点、记录打卡、发布攻略、提交新景点线索，并在个人中心持续沉淀旅行偏好。
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
            <div className="text-sm text-white/60">普通用户</div>
            <div className="mt-2 text-xl font-semibold">从这里注册</div>
            <p className="mt-2 text-sm leading-6 text-white/70">适合游客、内容创作者和普通协作者，注册后默认进入用户中心。</p>
          </div>
          <div className="rounded-[1.5rem] border border-white/15 bg-white/10 p-5">
            <div className="text-sm text-white/60">管理员</div>
            <div className="mt-2 text-xl font-semibold">不在这里注册</div>
            <p className="mt-2 text-sm leading-6 text-white/70">管理员请使用单独登录入口进入后台；正式环境建议由系统预先开通账号。</p>
            <Link href="/login?entry=admin" className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm text-brand-900">
              前往管理员登录
            </Link>
          </div>
        </div>

        <div className="mt-8 text-sm text-white/70">
          已经有普通用户账号？
          <Link href="/login" className="ml-1 text-amberleaf">
            去登录
          </Link>
        </div>
      </div>

      <AuthForm mode="register" entry="user" />
    </div>
  );
}
