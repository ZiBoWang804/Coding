# 协同开发变更标注

本文档用于在协同开发和代码上传时，明确标注本轮新增功能、修复项和影响范围，避免多人并行开发时出现重复提交或误覆盖。

## 标注规则

- 上传或提交和新功能相关的代码时，请保留 `[新增功能]` 前缀。
- 如果本轮同时包含性能优化、样式修复和新能力接入，请分开列出，便于协作者快速识别影响范围。
- 如果只是修复已有能力，请使用 `[修复]` 前缀，不要和新功能混写。

## 当前已接入的变更

### [协同整合] 2026-03-25 本地版本对齐远端基线

- 本地分支已与远端 `origin/master` 最新版本对齐，先对比了旧基线提交，再回放本地最新改动并逐项整合。
- 重点冲突文件（登录、后台、景点页、仓储层）采用“本地最新逻辑优先”，同时保留远端新增的协同能力和结构文件。
- 已补充任务记忆文档、管理员登录入口、后台热力图与规划页增强组件，便于多人协同继续开发。
- 已补充全国景点资料整合目录、媒体资源及导入脚本，并在 `.gitignore` 中新增临时文件忽略规则，避免误提交调试文件。

影响文件（核心）：

- `app/api/auth/login/route.ts`
- `app/admin/page.tsx`
- `app/login/page.tsx`
- `components/admin-dashboard.tsx`
- `components/planner-form.tsx`
- `lib/repository.ts`
- `lib/openai.ts`
- `TASK_MEMORY.md`
- `.gitignore`

### [新增功能] 西安地下交通到达建议

- 支持从任意西安出发点生成景点公交 / 地铁到达建议。
- 在规划结果页和景点详情页展示页面内换乘建议，并提供高德公开查询入口。

影响文件：

- `components/transit-assistant.tsx`
- `lib/transit-guide.ts`
- `components/planner-form.tsx`
- `components/planner/plan-results.tsx`
- `app/spots/[id]/page.tsx`

### [新增功能] 景点附近酒店与官方门票入口

- 在景点详情页接入附近酒店信息。
- 支持跳转到携程、华住会或已核实的官方住宿入口。
- 在智能推荐和景点卡片中加入附近酒店与价格参考。
- 对已核实景点优先跳转官方售票入口；无需门票时优先跳转官网。

影响文件：

- `lib/travel-resources.ts`
- `components/travel-service-panel.tsx`
- `components/spot-card.tsx`
- `components/planner/plan-results.tsx`
- `app/spots/[id]/page.tsx`
- `lib/demo-data.ts`

### [修复] 酒店服务区横向填充布局

- 修复酒店卡片在窄栏中被压缩成竖排长条的问题。
- 详情页改为整行展示，卡片按宽度横向铺满。

影响文件：

- `components/travel-service-panel.tsx`
- `app/spots/[id]/page.tsx`

### [新增功能] 管理员后台工作台

- 将原有简单后台升级为管理员工作台，新增平台概览、数据健康、活跃监控、景点管理、投稿审核分区。
- 支持管理员在后台直接新增、编辑、删除景点。
- 支持 CSV / XLSX 导入预览、字段映射和导入提交。
- 支持在演示模式下用本地文件持久化景点数据，方便无数据库环境下继续协同开发。
- 支持使用包含 `admin` 的演示邮箱登录管理员后台。

影响文件：

- `app/admin/page.tsx`
- `app/admin/import/page.tsx`
- `components/admin-dashboard.tsx`
- `components/admin-review-board.tsx`
- `components/import-workbench.tsx`
- `lib/repository.ts`
- `lib/demo-spot-store.ts`
- `lib/importer.ts`
- `types/index.ts`
- `app/api/spots/route.ts`
- `app/api/spots/[id]/route.ts`
- `app/api/admin/submissions/[id]/route.ts`
- `app/api/import/preview/route.ts`
- `app/api/import/commit/route.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/register/route.ts`

### [修复] 本地生产模式登录 Cookie

- 修复本地 `http://localhost:3000` / `http://127.0.0.1:3000` 访问时，生产模式强制使用 `Secure` Cookie 导致登录态无法写回的问题。
- 现在会根据 `APP_URL` 是否为 `https://` 决定是否启用安全 Cookie，方便本地验证管理员后台。

影响文件：

- `lib/auth.ts`

### [修复] 区分普通用户与管理员登录入口

- 登录页拆分为“普通用户登录”和“管理员登录”两个入口。
- 注册页明确仅面向普通用户，管理员改为单独登录入口。
- 演示模式下，普通用户入口不会因邮箱包含 `admin` 被误识别为管理员；管理员入口会单独校验。

影响文件：

- `app/login/page.tsx`
- `app/register/page.tsx`
- `components/auth-form.tsx`
- `components/auth-actions.tsx`
- `app/api/auth/login/route.ts`
- `app/api/auth/register/route.ts`
- `lib/auth.ts`

### [修复] 后台退出后返回用户界面

- 修复管理员在后台点击退出后，前端路由与后台重定向互相打断的问题。
- 退出后现在会直接跳回用户首页，后台路由在未登录状态下也会自动落到管理员登录入口。

影响文件：

- `components/auth-actions.tsx`
- `app/api/auth/logout/route.ts`
- `lib/auth.ts`

## 推荐提交信息格式

- `[新增功能] 接入西安地下交通到达建议`
- `[新增功能] 接入景点附近酒店与官方门票入口`
- `[修复] 调整酒店服务区横向填充布局`
- `[新增功能] 升级管理员后台工作台与导入中心`
- `[修复] 修正本地生产模式登录 Cookie`
- `[修复] 区分普通用户与管理员登录入口`
- `[修复] 修复后台退出后返回用户界面`
