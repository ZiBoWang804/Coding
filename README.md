# 游乡记 MVP

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

```bash
npm install
copy .env.example .env
npm run prisma:generate
npm run build
npm run start
```

默认访问：`http://localhost:3000`

如果你只想本地演示规划引擎，不依赖远程数据库，请在 `.env` 中保留：

```env
USE_DEMO_DATA="true"
```

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

## 合规边界

当前项目不包含针对小红书、携程、大众点评等平台的未授权抓取脚本。

## 环境变量

- `DATABASE_URL`
- `USE_DEMO_DATA`
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

- `DATABASE_URL`
- `USE_DEMO_DATA=false`
- `AI_PROVIDER=ark`
- `ARK_API_KEY`
- `ARK_MODEL=豆包推理接入点（当前示例：ep-20260322184009-6xlbl）`
- `ARK_BASE_URL=https://ark.cn-beijing.volces.com/api/v3`
- `APP_URL`
- `NEXT_PUBLIC_APP_NAME=游乡记`
