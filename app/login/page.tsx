import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ entry?: string; redirect?: string }>;
}) {
  const params = (await searchParams) || {};
  const entry = params.entry === "admin" ? "admin" : "user";

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:px-6 lg:grid-cols-[0.95fr,1.05fr] lg:px-8">
      <div className="rounded-[2rem] bg-brand-900 p-8 text-white shadow-card">
        <div className="text-sm tracking-[0.24em] text-white/60">{entry === "admin" ? "ADMIN ACCESS" : "USER ACCESS"}</div>
        <h1 className="mt-4 text-4xl font-semibold leading-tight">
          {entry === "admin" ? "进入管理员后台，集中处理景点数据、内容审核与平台监控。" : "登录后，个性化推荐、收藏、打卡和社区内容才会完整联动起来。"}
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/75">
          {entry === "admin"
            ? "管理员入口用于维护景点信息、审核投稿、查看平台监控。正式环境建议只使用已开通账号登录。"
            : "普通用户登录后可以保存偏好标签、搜索历史、打卡记录和攻略互动，用于持续优化行程推荐。"}
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className={`rounded-full px-4 py-2 text-sm ${
              entry === "user" ? "bg-white text-brand-900" : "border border-white/25 text-white/80"
            }`}
          >
            普通用户登录
          </Link>
          <Link
            href="/login?entry=admin"
            className={`rounded-full px-4 py-2 text-sm ${
              entry === "admin" ? "bg-white text-brand-900" : "border border-white/25 text-white/80"
            }`}
          >
            管理员登录
          </Link>
        </div>

        <div className="mt-10 space-y-3 text-sm text-white/70">
          {entry === "admin" ? (
            <>
              <p>本地演示模式下，邮箱中包含 `admin` 即可识别为管理员账号。</p>
              <p>
                如果你只是普通游客或内容创作者，请改走
                <Link href="/login" className="ml-1 text-amberleaf">
                  普通用户登录
                </Link>
                。
              </p>
            </>
          ) : (
            <>
              <p>
                还没有账号？
                <Link href="/register" className="ml-1 text-amberleaf">
                  去注册
                </Link>
              </p>
              <p>
                需要进入后台？
                <Link href="/login?entry=admin" className="ml-1 text-amberleaf">
                  管理员登录入口
                </Link>
              </p>
            </>
          )}
        </div>
      </div>

      <AuthForm mode="login" entry={entry} />
    </div>
  );
}
