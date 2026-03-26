import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getCurrentUser } from "@/lib/auth";

export default async function AdminLoginPage() {
  const user = await getCurrentUser();

  if (user?.role === "ADMIN") {
    redirect("/admin");
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr,1.05fr] lg:px-8">
      <div className="rounded-[2rem] bg-[linear-gradient(160deg,#112a22,#1a4032)] p-8 text-white shadow-card">
        <div className="text-sm tracking-[0.24em] text-white/60">ADMIN PORTAL</div>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">管理员入口与普通用户入口分开，避免误进和误操作。</h1>
        <p className="mt-4 text-sm leading-7 text-white/75">
          这个页面只用于管理员登录。登录后会进入后台，处理景点维护、用户投稿审核、数据导入和平台内容管理。
        </p>
        <div className="mt-8 space-y-3 text-sm text-white/72">
          <div>
            只是普通用户？
            <Link href="/login" className="ml-2 text-amberleaf">
              去用户登录
            </Link>
          </div>
          <div>
            还没有普通账号？
            <Link href="/register" className="ml-2 text-amberleaf">
              先去注册
            </Link>
          </div>
        </div>
      </div>
      <AuthForm mode="login" portal="admin" />
    </div>
  );
}
