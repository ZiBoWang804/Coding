# 网页主题聚类专题观察台

这是一个面向数据挖掘课程专题作业的完整演示项目。系统会先收集网页/新闻文章，对网页内容做聚类分析，再把每个聚类簇转成可理解的主题方向，供用户选择其中一个主题进行关注，并继续跟踪该主题下新文章的情感变化。

## 项目亮点

- 使用 `TF-IDF + KMeans` 对网页文本进行聚类
- 将聚类结果转为可解释的中文主题簇、关键词和代表文章
- 用户可将任意簇设为“关注主题”
- 基于后续文章做主题相关度筛选与情感分析
- 全站界面改为中文展示，适合课堂展示和答辩演示
- 新增更多网站/来源样本，当前演示数据覆盖 24 个来源、8 组主题方向、48 篇初始网页样本
- 在线模式补充为 11 路 BBC RSS 源，课堂展示时可切到 `live`/`auto` 获取更多网页
- 页面包含主题簇网络图、来源覆盖面板、聚类卡片、主题情感时间线等可视化模块

## 功能结构

1. 数据采集
   - `demo`：默认启动模式，使用内置样本数据，稳定适合课堂展示
   - `live`：抓取在线 RSS 内容
   - `auto`：优先尝试在线抓取，失败后自动回退到演示数据

2. 聚类分析
   - 构建文章文本特征
   - 使用 KMeans 进行网页聚类
   - 提取每个簇的高频关键词作为主题线索

3. 主题跟踪
   - 用户选择一个簇作为关注主题
   - 系统对后续文章计算主题相关度
   - 输出该主题下的最新相关文章

4. 情感分析
   - 对相关文章做轻量词典式情感判断
   - 输出正面 / 中性 / 负面分布
   - 用时间线展示主题情感动态

## 技术方案

- 后端服务：Python 标准库 `http.server`
- 文本特征：`scikit-learn` 的 `TfidfVectorizer`
- 聚类：本地 `numpy` 版 KMeans 流程
- 相似度计算：余弦相似度
- 情感分析：轻量词典法
- 前端：原生 HTML / CSS / JavaScript
- 可视化：SVG 网状分布图 + 情感时间线 + 中文信息卡片

说明：
当前环境下 `scikit-learn` 原生 `KMeans.fit` 会触发 Windows / Anaconda / `threadpoolctl` 兼容问题，因此运行时聚类改为等价的 `numpy` 实现，保证项目在本机可直接跑通。

## 目录结构

```text
web classification/
├─ docs/
│  └─ system_flow.md
├─ generated/
│  └─ dashboard.json
├─ src/
│  ├─ demo_data.py
│  ├─ live_fetch.py
│  ├─ pipeline.py
│  ├─ server.py
│  └─ text_analysis.py
├─ tests/
│  └─ test_pipeline.py
├─ web/
│  ├─ app.js
│  ├─ index.html
│  └─ styles.css
├─ findings.md
├─ progress.md
├─ run_app.py
└─ task_plan.md
```

## 运行方式

在目录 `D:\wzb\数据挖掘\web classification` 中执行：

```powershell
python run_app.py
```

然后在浏览器打开：

```text
http://127.0.0.1:8765
```

## 推荐演示流程

1. 启动应用
2. 将“数据模式”切换为“演示样例”
3. 点击“重新聚类并刷新看板”
4. 在主题簇卡片或主图中选择一个簇设为关注
5. 展示该主题的关键词、来源分布、相关文章和情感时间线

## 测试与验证

```powershell
python -m compileall src run_app.py tests
python -m unittest discover -s tests -v
python -m src.pipeline
```

## Figma 参考

- 中文看板布局图：
  [中文聚类仪表盘布局](https://www.figma.com/online-whiteboard/create-diagram/42b61440-b962-4511-a20e-ec66cbdcb87d?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=c2e1db4b-2eb4-4023-acb8-4a89027584f1)

## 补充说明

- `generated/dashboard.json` 会保存最近一次生成的分析结果
- PowerShell 终端在个别情况下会把中文显示成乱码，但接口和页面输出为正常 UTF-8 中文
- 如果课堂网络不稳定，建议直接使用 `demo` 模式
