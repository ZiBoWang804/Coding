# 游乡记 MVP

## 新手先看这里

如果你是完全不懂操作的新手，并且电脑里没有安装 Node.js，也没有配置代理，请先看这些教程：

- [docs/新手使用教程.md](docs/新手使用教程.md)
- [docs/数据库完整版启动教程.md](docs/数据库完整版启动教程.md)

当前项目已经附带了可直接使用的 Node 运行环境、`node_modules` 和构建产物。对演示体验来说，最简单的方式就是双击项目根目录里的：

- `1-启动项目-演示模式.cmd`
- `2-初始化数据库-完整版.cmd`
- `3-启动项目-数据库完整版.cmd`

演示模式默认访问：`http://localhost:3001`

数据库完整版默认访问：`http://localhost:3000`

游乡记是一个面向乡村旅游场景的智能规划平台 MVP，采用 Next.js + TypeScript + Tailwind CSS + Prisma + PostgreSQL 构建，优先支持响应式 Web 和 PWA 形态，方便后续扩展为正式 App。

## 功能概览

- 首页品牌展示、搜索、分类入口、推荐路线
- 目的地列表与详情页
- 乡旅地图（Leaflet）
- 想去 / 去过 / 收藏本地状态
- AI 旅游规划引擎
  - 规则过滤 + 评分排序 + 行程生成 + 解释输出
  - 支持 1 / 2 / 3 日乡村短途规划
  - 显式考虑预算、交通、天气、节假日、人流、住宿、餐饮、同行人群
  - 没有实时接口时自动走 mock weather / traffic / destination adapter
- 简易后台管理
- CSV / XLSX 导入预览、字段映射、去重导入
- 第三方内容观察数据导入（手动导出文件，不含站点抓取）
- 内置全国样例数据 + 西安周边规划 mock 数据

## 协同开发更新（2026-03-25）

- 已将本地最新开发分支与远端 `origin/master` 完成对齐整合，冲突点主要集中在登录、后台工作台、景点详情和仓储层。
- 新增管理员独立登录入口：`/admin/login`，并在登录接口中补充入口角色校验。
- 后台能力扩展为“概览 + 审核 + 热力图 + 导入”组合工作台，支持更完整的运营闭环。
- 规划链路与资源推荐持续增强，补充景点服务面板、规划页交互扩展和全国旅游资料整合资产。
- 协作文档已更新：`docs/collaboration-change-log.md` 与 `TASK_MEMORY.md`。

## 技术栈

- 前端：Next.js App Router + TypeScript + Tailwind CSS
- 后端：Next.js Route Handlers
- 数据库：PostgreSQL
- ORM：Prisma
- 地图：Leaflet + React Leaflet
- 校验：Zod
- 文件导入：xlsx
- 可选 AI：火山方舟 Ark API / OpenAI 兼容接入
- 部署：Vercel + Supabase / Neon PostgreSQL

## 本地启动

数据库已经改成任意托管 PostgreSQL，不再默认连接本机 `localhost:5432`。Supabase、Neon、阿里云 RDS 或其他云厂商都可以，只要给出 PostgreSQL 连接串。

```bash
npm install
copy .env.example .env
```

然后编辑 `.env`：

- `DATABASE_URL`：应用运行时使用。有连接池时填池化地址。
- `DIRECT_URL`：迁移和导入使用的直连地址。没有连接池时与 `DATABASE_URL` 相同。
- `USE_DEMO_DATA="false"`：真正读写云数据库。

```bash
npm run prisma:generate
npm run prisma:push
npm run seed
npm run db:check
npm run build
npm run start
```

`npm run db:check` 成功时会打印 `连接成功`，以及景点和用户数量。

默认访问：`http://localhost:3000`。这里的 localhost 只是网站地址，数据库在云上。

如果你只想看页面、不连接数据库，把 `USE_DEMO_DATA` 改成 `"true"`，或者双击 `1-启动项目-演示模式.cmd`。演示模式不会读取 `DATABASE_URL`。

更完整的云数据库步骤、三种厂商的连接串示例、白名单和把本机旧数据迁过去的方法，写在 [docs/数据库完整版启动教程.md](docs/数据库完整版启动教程.md)。

## AI 规划引擎目录

```text
lib/planner/
  enums.ts
  types.ts
  config.ts
  normalizers.ts
  destination-mapper.ts
  filters.ts
  scoring.ts
  weather-adjuster.ts
  traffic-adjuster.ts
  seasonal-adjuster.ts
  itinerary-generator.ts
  explain.ts
  planner.ts
  index.ts
lib/providers/
  weather-provider.ts
  traffic-provider.ts
  holiday-provider.ts
```

## 规划引擎输入输出

API：`POST /api/planner`

核心输入结构：

```json
{
  "origin": "Xi'an Urban Area",
  "travelDate": "2026-03-22",
  "days": 1,
  "budgetMin": 300,
  "budgetMax": 500,
  "transportMode": "self_drive",
  "companions": "couple",
  "preferenceTags": ["拍照", "安静", "特色民宿", "乡村风景"],
  "crowdPreference": "avoid_crowds",
  "pacePreference": "slow",
  "specialConstraints": []
}
```

返回结构：

```json
{
  "recommendedPlans": [
    {
      "destinationId": "xian-zhanglong",
      "destinationName": "Zhanglong Bamboo Trail",
      "totalScore": 79.33,
      "scoreBreakdown": {
        "timeFit": 20,
        "transportFit": 11.79,
        "companionFit": 10.8,
        "weatherFit": 10.92,
        "budgetFit": 10,
        "seasonFit": 8,
        "lodgingFit": 4.06,
        "diningFit": 0.88,
        "tagFit": 1.88
      },
      "rankingReason": [],
      "whyFitUser": [],
      "weatherAdjustmentReason": [],
      "crowdAdjustmentReason": [],
      "budgetEstimate": {
        "transport": 120,
        "lodging": 0,
        "dining": 90,
        "activities": 189,
        "totalMin": 354,
        "totalMax": 474
      },
      "transportSummary": "...",
      "lodgingSummary": "...",
      "diningSummary": "...",
      "risks": [],
      "itinerary": [],
      "alternativeOptions": []
    }
  ],
  "readableSummary": {
    "headline": "Top pick: Zhanglong Bamboo Trail",
    "recommendation": [],
    "dynamicImpact": [],
    "cautions": [],
    "alternatives": []
  }
}
```

## 规划引擎扩展点

### 1. 接入实时天气

替换 [weather-provider.ts](D:/wzb/codex/lib/providers/weather-provider.ts) 的 mock 读取逻辑即可，返回 `WeatherContext`。

### 2. 接入实时交通 / 路况 / 节假日

替换 [traffic-provider.ts](D:/wzb/codex/lib/providers/traffic-provider.ts) 和 [holiday-provider.ts](D:/wzb/codex/lib/providers/holiday-provider.ts)。

### 3. 扩展目的地字段

将新增字段先写入 [types/index.ts](D:/wzb/codex/types/index.ts) 或 Prisma 模型，再在 [destination-mapper.ts](D:/wzb/codex/lib/planner/destination-mapper.ts) 中补映射。

### 4. 扩展标签标准化

在 [normalizers.ts](D:/wzb/codex/lib/planner/normalizers.ts) 里追加中文自由文本、人工标签和小红书口语标签映射。

### 5. 调整评分权重

修改 [config.ts](D:/wzb/codex/lib/planner/config.ts) 中的基础权重和画像权重覆盖。

## Mock 数据

- 规划 mock 目的地：`data/mock-destinations.json`
- 规划 mock 天气：`data/mock-weather.json`
- 规划 mock 路况：`data/mock-traffic.json`
- 规划测试样例：`data/planner-test-cases.json`
- 规划样例输出：`data/planner-test-results.json`

## 运行三组内置样例

```bash
npm run test:planner
```

脚本会读取 `data/planner-test-cases.json`，执行规划引擎，并输出到 `data/planner-test-results.json`。

内置样例：

1. 西安市区出发，周末 1 日，情侣，自驾，拍照 + 安静 + 民宿偏好，天气多云
2. 西安市区出发，周末 2 日，亲子，自驾，自然 + 互动体验，天气高温
3. 西安市区出发，1 日，长辈同行，公共交通优先，轻松 + 文化体验，天气小雨

## 火山方舟接入

当前默认配置为：

```env
AI_PROVIDER="ark"
ARK_API_KEY="你的火山引擎 key"
ARK_MODEL="ep-20260322184009-6xlbl"
ARK_BASE_URL="https://ark.cn-beijing.volces.com/api/v3"
APP_URL="http://localhost:3000"
```

如果不配置 `ARK_API_KEY`，系统仍然可用，只走规则引擎。

## 样例数据

- 主样例数据：`data/rural-spots.seed.csv`
- 官方重点村镇导入样例：`data/official_list_sample.csv`
- 第三方观察数据样例：`data/third-party-observations.sample.csv`
- 西安乡村点位样例：`data/xian-rural-spots.cleaned.csv`

## 数据导入

### 导入目的地数据

```bash
npm run import:spots -- --file=./data/official_list_sample.csv --source=official_list_sample --batch=official-sample
```

### 导入第三方观察数据

```bash
npm run import:observations -- --file=./data/third-party-observations.sample.csv --source=manual_export --batch=third-party-demo
```

### 统一同步三类整合数据（景点画像 + 攻略 + 小红书）

```bash
npm run import:integrated-sync
```

说明：
- 脚本会读取 `data/131景点资料整合_2026-03-25`、`data/全国旅游数据整合_2026-03-24`、`data/小红书旅游数据整合_2026-03-25` 的核心 CSV。
- 自动做景点去重、攻略摘要合并、图片同步到 `public/media/integrated-spots`，并写出导入报告 `data/import-ready/integrated-sync.report.json`。
- 若数据库暂时不可达，会自动回退到 demo runtime store，保证平台可先同步看到最新数据。
- `Spot` 的复合唯一键包含 `district`；当历史数据里 `district` 为空时，导入脚本会自动走“命中映射后按 `id` 更新，否则创建”的策略，避免 Prisma 在 `upsert.where` 中因空值失败。

### 审查并补全景点数据

```bash
npm run audit:spots
```

说明：
- 清洗描述中冗余的 `图文来源` 尾巴，减少英文来源名和 OCR 杂质直接暴露到平台。
- 对已人工核验的热门景点补充区县、中文地址和更适合展示的简介。
- 输出审查报告到 `data/import-ready/spot-audit.report.json`，便于协同开发复核。

### 删除无法补全的低质量景点

```bash
npm run prune:spots
```

说明：
- 仅删除 `national_poi_2025_cleaned` 中无地址、无图片、只有模板描述且没有任何用户关联数据的旧 POI。
- 输出删除报告到 `data/import-ready/spot-prune.report.json`，方便回溯删除范围与样例。

### 批量补全剩余景点详情

```bash
npm run enrich:remaining-spots
```

说明：
- 基于本地 `景点画像汇总_含平台照片.csv` 的详情页索引，批量抓取景点地址、简介、游玩时长和坐标。
- 优先修复缺地址、英文占位地址、缺坐标的剩余景点。
- 输出补全报告到 `data/import-ready/remaining-spots-enrich.report.json`。

### 最后一轮人工精修残留景点

```bash
npm run final-refine:spots
```

说明：
- 对最后一批仍缺地址或仍保留英文地址的景点进行人工校准，补全区县和中文地址。
- 对已经确认是泛化标题、噪声关联或无法可靠落到具体景点的空壳 POI 直接删除。
- 输出最终精修报告到 `data/import-ready/remaining-spots-final-refine.report.json`，便于复盘这批补全和删除依据。

## 合规边界

当前项目不包含针对小红书、携程、大众点评等平台的未授权抓取脚本。

## 环境变量

- `DATABASE_URL`：应用连接串。云数据库需要 `sslmode=require`；连接池地址还要 `pgbouncer=true`。无服务器部署再加 `connection_limit=1`。
- `DIRECT_URL`：迁移直连串。`prisma db push`、`prisma migrate` 和种子导入都走它。
- `USE_DEMO_DATA`：`true` 时忽略数据库，只用内置演示数据。
- `AI_PROVIDER`
- `ARK_API_KEY`
- `ARK_MODEL`
- `ARK_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `APP_URL`
- `NEXT_PUBLIC_APP_NAME`

## 部署到 Vercel

在 Vercel 中至少配置：

- `DATABASE_URL`：使用连接池地址，并带上 `pgbouncer=true&connection_limit=1&sslmode=require`
- `DIRECT_URL`：使用不经过连接池的直连地址，迁移时需要它
- `USE_DEMO_DATA=false`
- `AI_PROVIDER=ark`
- `ARK_API_KEY`
- `ARK_MODEL=豆包推理接入点（当前示例：ep-20260322184009-6xlbl）`
- `ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3`
- `APP_URL`
- `NEXT_PUBLIC_APP_NAME=游乡记`
