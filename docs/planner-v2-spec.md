# 智能旅游规划 v2 设计与模板

## 一、核心函数结构（代码级伪代码）

```ts
async function prepare_request(input): Promise<ServiceEnvelope<PreparedRequest>> {
  // 1) 参数检查（必填、类型、范围）
  // 2) 候选景点压缩成 refId，减少 prompt token
  // 3) 返回统一 JSON：{ ok, data, error, meta }
}

async function knowledge_service_chat(prepared): Promise<ServiceEnvelope<KnowledgeResult>> {
  // 1) 检查火山知识库配置
  // 2) 组装 query（用户条件 + 候选景点）
  // 3) 超时控制 + HTTP 错误处理 + 返回内容校验
  // 4) 失败时不阻断主流程，返回 status=failed/skipped
}

async function get_weather_info(prepared): Promise<ServiceEnvelope<DynamicInfo>> {
  // 1) includeLiveSignals=false -> 直接回退静态天气
  // 2) 调用 web search 查询实时天气
  // 3) 提取风险等级（high/medium/low）
  // 4) 失败时回退 context.weather
}

async function get_traffic_info(prepared): Promise<ServiceEnvelope<DynamicInfo>> {
  // 1) includeLiveSignals=false -> 直接回退静态路况
  // 2) 调用 web search 查询实时交通
  // 3) 提取风险等级（high/medium/low）
  // 4) 失败时回退 context.traffic
}

function create_travel_plan_prompt(prepared, weather, traffic, kb): ServiceEnvelope<PromptPayload> {
  // 1) 合并静态数据 + 知识库 + 动态信息
  // 2) 注入“禁止捏造”与“官方数据优先”规则
  // 3) 按风险等级动态写入优先级策略（恶劣天气必须给备选）
  // 4) 输出严格 JSON schema 约束
}

async function generate_travel_plan(input): Promise<ServiceEnvelope<GenerateTravelPlanResult>> {
  // 1) prepare_request
  // 2) 并行调用：weather / traffic / knowledge
  // 3) create_travel_plan_prompt
  // 4) 调用大模型，解析 JSON，做 schema 校验
  // 5) 校验失败时回退到 deterministic fallback
  // 6) 输出兼容前端与旧规划引擎的数据结构
}
```

## 二、Prompt 模板（可直接调用）

```text
你是“智能旅游规划师 + 数据解释器”。

任务目标：
基于平台静态数据、火山知识库补充信息和实时天气/交通，生成真实、可执行、可解释的旅游计划。

事实约束：
1. 禁止编造事实，无法确认的内容必须写“请以官方数据为准”。
2. 优先使用实时天气与交通信息；若冲突，以更实时的数据为准。
3. 如果天气恶劣/拥堵严重，必须提供备选路线与室内方案。

输入数据：
- 用户条件：{origin, destinationQuery, travelDate, days, budget, preferenceTags, companions, ...}
- 实时天气摘要：{weather_summary}
- 实时交通摘要：{traffic_summary}
- 知识库补充：{knowledge_summary}
- 候选景点：[{id, name, city, tags, openingHoursText, ...}]

输出格式：仅输出 JSON，不要输出 markdown。
输出 schema：
{
  "summary": "string",
  "weather_summary": "string",
  "traffic_summary": "string",
  "budget_distribution": {
    "transport": "number",
    "lodging": "number",
    "dining": "number",
    "activities": "number",
    "total_min": "number",
    "total_max": "number"
  },
  "itinerary": [
    {
      "day": "number",
      "destination_id": "string",
      "destination_name": "string",
      "activities": ["string"],
      "transport_plan": "string",
      "meal_recommendations": ["string"],
      "estimated_cost": "number"
    }
  ],
  "dynamic_suggestions": ["string"],
  "cautions": ["string"],
  "warm_tips": ["string"],
  "missing_data_notes": ["string"]
}
```

