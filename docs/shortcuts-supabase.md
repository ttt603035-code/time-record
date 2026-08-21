# 快捷指令 → Supabase → 看板

> **颜色说明（新版）**：现在颜色由网站里的「日程模板」统一管理 —— 只要 `category` 和模板同名，同步时会自动套用模板颜色并覆盖这里传的 `color`。所以 **`color` 字段可以不传或随便填 `blue`**，下文的颜色映射仅作参考。逐步教程见 [shortcuts-step-by-step.md](shortcuts-step-by-step.md)（无颜色版）。

> 想要一步一步照着点的版本，看 **[shortcuts-step-by-step.md](shortcuts-step-by-step.md)**（含建库、每个动作填什么、验收和排错）。本文是字段与协议的参考手册。

这份文档说明：iPhone 快捷指令 `time record 1` 的 **结束** 和 **补录** 两个分支，完成后如何把这条记录写进你自己的 Supabase `events` 表，让本站（今天 / 日历 / 洞悉）打开就能看到。

分工不变：

- **录入**在快捷指令里做（系统日历照常创建/更新日程、照常通知）。
- **看板**在本站，只读已完成的记录，不提供开始/结束/进行中。
- 快捷指令多做一步：日历那步成功之后，再发一个 HTTP 请求把同一条记录 POST 到 Supabase。

```
快捷指令（结束 / 补录）
   ├─ 更新 / 创建系统日历日程   ← 原有行为，不动
   ├─ 通知                      ← 原有行为，不动
   └─ 获取 URL 内容 POST → Supabase /rest/v1/events → 本站看板
```

---

## 0. 前置准备（只做一次）

1. 在 Supabase 项目的 **SQL Editor** 执行建表 SQL：本站「更多 → 云同步 → 设置」里那段（`create table public.events ...`），或 README 里的同一段。
2. 记下三样东西：

| 名称 | 在哪拿 | 例子 |
| --- | --- | --- |
| 项目 URL | Supabase → Settings → Data API → Project URL | `https://abcdefghijk.supabase.co` |
| anon public key | Supabase → Settings → API Keys → `anon public` | `eyJhbGciOi...`（很长） |
| 同步口令 `user_key` | 你自己定，一段私密长字符串 | `my-time-record-2026` |

3. 在本站「更多 → 云同步」填同样的三项并保存。**口令必须和快捷指令里写的完全一致**，否则网站看不到快捷指令写入的行。

> 安全提醒：anon key 是公开凭据，拿到它的人就能读写这张表。请用你自己的项目，不要放敏感内容。

---

## 1. 请求本体

**URL**（注意是 REST 接口，不是 dashboard 网页）

```
https://<你的项目>.supabase.co/rest/v1/events
```

**方法**：`POST`

**Headers**

| Header | 值 |
| --- | --- |
| `apikey` | `<anon public key>` |
| `Authorization` | `Bearer <anon public key>`（Bearer 后面有一个空格） |
| `Content-Type` | `application/json` |
| `Prefer` | `resolution=merge-duplicates,return=minimal` |

`Prefer: resolution=merge-duplicates` 让同一个 `id` 重发时变成更新而不是报 409，重试很安全；`return=minimal` 让返回体为空、快捷指令不用解析。

**Body（JSON）**

```json
{
  "id": "evt_20260820T143512_481902",
  "user_key": "my-time-record-2026",
  "date": "2026-08-20",
  "start_time": "14:05",
  "end_time": "14:35",
  "title": "CET-6 阅读",
  "category": "English",
  "color": "blue",
  "note": "CET-6 阅读 已完成",
  "created_at": "2026-08-20T14:35:12.000Z",
  "updated_at": "2026-08-20T14:35:12.000Z"
}
```

成功时 HTTP `201`，Body 为空。

---

## 2. 字段怎么填（和日历标题的对应关系）

| 字段 | 内容 | 快捷指令里的来源 |
| --- | --- | --- |
| `id` | 主键，见下节 | 现生成 |
| `user_key` | 同步口令 | 写死在快捷指令里的文本 |
| `date` | **开始那天**的 `YYYY-MM-DD` | 「开始时间」→ 格式化日期 |
| `start_time` | `HH:MM`（24 小时制） | 「开始时间」→ 格式化日期 |
| `end_time` | `HH:MM` | 「结束时间」→ 格式化日期 |
| `title` | **二级分类**（日程内容），**不带**「N 分钟」 | 变量「二级分类」/「日程内容」 |
| `category` | **一级分类**：`English` / `Chinese` / `Politics` / `Health` / `Study` / `Daily` / `relax` / `Todolist` | 变量「一级分类」/「first选择」 |
| `color` | **可省略**：网站会按 `category` 套用模板颜色并覆盖此值 | 填 `blue` 即可 |
| `note` | 备注，可填 `二级分类 已完成` | 和日历备注同一段文本 |
| `created_at` / `updated_at` | ISO 8601 时间戳 | 「当前日期」→ ISO 8601 格式 |

**和日历标题的对应**：日历日程标题仍然是「二级分类 + 空格 + 持续时长 + 分钟」（例如 `CET-6 阅读 30 分钟`）。Supabase 里 **不要** 把分钟数写进 `title` —— 时长由 `start_time`/`end_time` 算出来，标题里再带一遍会让洞悉把「CET-6 阅读 30 分钟」和「CET-6 阅读 45 分钟」当成两个不同任务，排行和饼图就碎了。

**可用的 `color` 值**（其他值会被网站当作 `blue`；也可以直接写 `#RRGGBB`）：

```
blue sky cyan teal seafoam mint green sage
gold yellow sand orange peach coral red wine
blush pink mauve purple lilac indigo brown slate gray
```

建议的固定映射（可自行调整，在快捷指令里用一个字典查表）：

| 一级分类 | color |
| --- | --- |
| English | `blue` |
| Chinese | `red` |
| Politics | `indigo` |
| Health | `green` |
| Study | `purple` |
| Daily | `sand` |
| relax | `mint` |
| Todolist | `gray` |

---

## 3. `id` 怎么生成

要求：全局唯一、同一条记录重发时保持不变。网站自己生成的是 `evt_<时间戳36进制>_<随机6位>`，快捷指令里没有这两个函数，用等价写法即可：

```
evt_ + 【格式化日期：当前日期，自定义格式 yyyyMMdd'T'HHmmss】 + _ + 【随机数 100000–999999】
```

例：`evt_20260820T143512_481902`。

要点：

- 先用「文本」动作把它拼好、存成变量 `记录ID`，**在构造 JSON 之前生成一次**，这样失败重跑时如果沿用同一个变量就是更新而不是新增。
- 不要用「二级分类 + 日期」这种可能重复的组合当 id（同一天同一个任务做两次会互相覆盖）。
- 不要留空：`id` 是主键，为空会直接 400。

---

## 4. 结束分支：在快捷指令里加什么

在原流程第 7 步（显示通知）**之后**追加，前面的动作一个都不改：

1. **格式化日期** — 输入「开始时间」，自定义格式 `yyyy-MM-dd` → 变量 `日期`
2. **格式化日期** — 输入「开始时间」，自定义格式 `HH:mm` → 变量 `开始HHMM`
3. **格式化日期** — 输入「结束时间」，自定义格式 `HH:mm` → 变量 `结束HHMM`
4. **格式化日期** — 输入「结束时间」，格式选 ISO 8601（含时间）→ 变量 `时间戳`
5. **随机数** 100000 到 999999 → 变量 `随机`
6. **格式化日期** — 输入「结束时间」，自定义格式 `yyyyMMdd'T'HHmmss` → 变量 `时间串`
7. **文本**：`evt_时间串_随机` → 变量 `记录ID`
8. **字典**（键 / 值，值全部用文本或变量）：

   | 键 | 值 |
   | --- | --- |
   | id | `记录ID` |
   | user_key | 你的同步口令 |
   | date | `日期` |
   | start_time | `开始HHMM` |
   | end_time | `结束HHMM` |
   | title | 变量「二级分类」 |
   | category | 变量「一级分类」 |
   | color | 颜色名（或查表结果） |
   | note | `二级分类 已完成` |
   | created_at | `时间戳` |
   | updated_at | `时间戳` |

9. **获取 URL 内容**
   - URL：`https://<你的项目>.supabase.co/rest/v1/events`
   - 方法：`POST`
   - 请求头：`apikey`、`Authorization`、`Content-Type`、`Prefer`（值见第 1 节）
   - 请求体：选 **JSON**，内容选上一步的 **字典** 变量（若选「文件」，就传字典；不要手拼字符串，中文容易被转义坏）
10.（可选）**如果**「获取 URL 内容」出错 → **显示通知**「云端上传失败，稍后在网站点同步」。日历那条已经写好了，云端补传不影响记录本身。

跨天的一条（例如 23:40 → 00:20）：`date` 用开始那天，`end_time` 会小于 `start_time`，网站按当天渲染。真要跨夜建议拆成两条补录，看板更准。

---

## 5. 补录分支：在快捷指令里加什么

补录分支已经有「开始时间」「结束时间」「日程内容」「first选择」四个变量，所以在原流程第 9 步（创建日历日程）**之后**，把第 4 节的第 1–9 步原样加一遍，只改变量名对应：

- `title` ← 「日程内容」
- `category` ← 「first选择」
- `note` ← 可留空，或写 `补录`
- 时间戳 `created_at` / `updated_at` 用「当前日期」（补录动作发生的时刻），`date` / `start_time` / `end_time` 仍然用用户输入的起止时间。

---

## 6. 先用 curl 验一遍（推荐）

在电脑上把三个占位替换掉跑一次，确认表和策略没问题，再去改快捷指令：

```bash
curl -i -X POST 'https://<你的项目>.supabase.co/rest/v1/events' \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "Content-Type: application/json" \
  -H "Prefer: resolution=merge-duplicates,return=minimal" \
  -d '{
    "id": "evt_test_000001",
    "user_key": "<你的同步口令>",
    "date": "2026-08-20",
    "start_time": "14:05",
    "end_time": "14:35",
    "title": "CET-6 阅读",
    "category": "English",
    "color": "blue",
    "note": "测试",
    "created_at": "2026-08-20T14:35:12.000Z",
    "updated_at": "2026-08-20T14:35:12.000Z"
  }'
```

返回 `HTTP/2 201` 即成功。然后打开本站「今天」，应该能看到这一块（网站进入今天/日历/洞悉时会自动拉取；也可以点右上角「同步」手动拉）。测试完在 Supabase 里把这行删掉，或在网站里删掉这个日程。

---

## 7. 报错对照表

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `401` + `Invalid API key` | key 填错，或 `Authorization` 少了 `Bearer ` | 重新复制 anon public key |
| `404` + `relation "public.events" does not exist` | 没建表 | 执行建表 SQL |
| `401/403` + `row-level security` | 没建 policy | 执行建表 SQL 里的 `create policy` 那段 |
| `400` + `null value in column "id"` | id 变量为空 | 检查第 7 步的文本动作 |
| `409` | 同一个 id 重复且没带 merge | 补上 `Prefer: resolution=merge-duplicates` |
| 写入成功但网站看不到 | `user_key` 和网站里填的不一致 | 两边改成同一个字符串 |
| 网站显示「无法连接服务器」 | 项目 URL 写成了 dashboard 地址 | 必须是 `https://xxxx.supabase.co`，不是 `supabase.com/dashboard/...` |

网站侧的失败提示会写明具体原因（找不到表 / anon key 被拒绝 / 被行级安全策略拦截 / 网络不通），按上表处理即可。
