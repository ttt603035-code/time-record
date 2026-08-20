# 快捷指令逐步配置（保姆版）

这份是 [`shortcuts-supabase.md`](shortcuts-supabase.md) 的手把手版本：打开 iPhone 的「快捷指令」App，照着一步步点就行。

**你只需要改 `time record 1` 里的两个分支：结束、补录。**「开始」和「todo list」一个动作都不用碰，日历和提醒事项的行为完全不变。

先做一次 A 部分（Supabase 建库，5 分钟，只做一次），再做 B（结束分支）和 C（补录分支）。

---

## A. 只做一次：把「信箱」建好

### A1. 建 Supabase 项目

1. 电脑或手机浏览器打开 <https://supabase.com>，用 GitHub 或邮箱注册（免费）。
2. **New project** → 名字随便填（比如 `time-record`）→ 数据库密码随便设一个（这个密码后面用不到，但要存好）→ 地区选 **Northeast Asia (Tokyo)** 或 **Central EU (Frankfurt)** 都行 → Create。
3. 等 1–2 分钟建好。

### A2. 建表

1. 左侧栏 **SQL Editor** → **New query**。
2. 把下面整段粘进去，点 **Run**。看到 `Success. No rows returned` 就成了。

```sql
create table if not exists public.events (
  id          text primary key,
  user_key    text not null,
  date        text not null,
  start_time  text not null,
  end_time    text not null,
  title       text not null,
  category    text default '',
  color       text default 'blue',
  note        text default '',
  created_at  text,
  updated_at  text
);

create index if not exists events_user_key_idx
  on public.events (user_key);

alter table public.events enable row level security;

create policy "anon full access" on public.events
  for all to anon
  using (true)
  with check (true);
```

### A3. 抄下三个值

| 要抄的 | 在哪 | 长什么样 |
| --- | --- | --- |
| **项目 URL** | 左下 Settings → Data API → Project URL | `https://abcdefghijklmn.supabase.co` |
| **anon key** | 左下 Settings → API Keys → `anon` `public` 那一行 | `eyJhbGciOiJIUzI1NiIs...`（很长，点复制） |
| **同步口令** | 你自己编 | 比如 `wo-de-time-record-2026` |

把这三个值发到自己的备忘录里，等会儿手机上要粘贴。

⚠️ 项目 URL 一定是 `https://xxxx.supabase.co`，**不是** 浏览器地址栏里的 `supabase.com/dashboard/project/...`。

### A4. 网站上填一遍

打开你的看板网站 → **更多** → **云同步** → **设置** → 三项填上（和上面完全一致）→ **测试连接** 显示成功 → **保存**。

口令必须和快捷指令里等会儿要写的那串**一模一样**，差一个字符就互相看不见。

---

## B. 改「结束」分支（核心）

打开快捷指令 App → 长按 `time record 1` → **编辑**。

找到结束分支的最后一个动作 —— 就是那个 **显示通知**「恭喜你！你完成 …」。**所有新动作都加在它下面**，原有动作一个都不删、不改。

> 小技巧：在动作列表底部搜索动作名添加，添加后长按拖到通知那一步的正下方；或者直接把光标停在通知下面再搜索添加。

下面 9 步，序号就是添加顺序。

---

### B1. 格式化日期 → 拿到「日期」

- 搜索添加：**格式化日期**
- 「日期」这个空格 → 选变量 **开始时间**
- 「日期格式」下拉 → 选 **自定**
- 「格式字符串」里输入：`yyyy-MM-dd`
- 长按这个动作的结果 →（或点动作底部的变量）→ **重命名** 为 `日期`

得到的效果：`2026-08-20`

### B2. 格式化日期 → 拿到「开始HHMM」

- 再加一个 **格式化日期**
- 日期 → 变量 **开始时间**
- 日期格式 → **自定** → 格式字符串：`HH:mm`
- 结果重命名为 `开始HHMM`

效果：`14:05`（注意 `HH` 大写是 24 小时制，`mm` 小写是分钟，别写成 `MM`，那是月份）

### B3. 格式化日期 → 拿到「结束HHMM」

- 再加一个 **格式化日期**
- 日期 → 变量 **结束时间**
- 自定 → `HH:mm`
- 结果重命名为 `结束HHMM`

### B4. 格式化日期 → 拿到「时间戳」

- 再加一个 **格式化日期**
- 日期 → 变量 **结束时间**
- 日期格式 → **ISO 8601**（如果只有「自定」，就用格式字符串 `yyyy-MM-dd'T'HH:mm:ss'Z'`）
- 结果重命名为 `时间戳`

这个是给 `created_at` / `updated_at` 用的。

### B5. 格式化日期 → 拿到「时间串」（给 id 用）

- 再加一个 **格式化日期**
- 日期 → 变量 **结束时间**
- 自定 → 格式字符串：`yyyyMMddHHmmss`
- 结果重命名为 `时间串`

效果：`20260820143512`

### B6. 随机数

- 搜索添加：**数字之间的随机数**（英文 Random Number）
- 最小 `100000`，最大 `999999`
- 结果重命名为 `随机`

### B7. 文本 → 拼出 id

- 搜索添加：**文本**
- 内容里依次输入 / 插入：

  ```
  evt_[时间串]_[随机]
  ```

  也就是：先打 `evt_`，然后插入变量 `时间串`，再打 `_`，再插入变量 `随机`。
- 结果重命名为 `记录ID`

效果：`evt_20260820143512_481902`

> 为什么要这么麻烦：`id` 是这条记录的身份证，必须唯一。用「时间 + 随机数」保证同一秒点两次也不会撞车。

### B8. 词典 → 把 11 个字段装好

- 搜索添加：**词典**（英文 Dictionary）
- 点 **添加新项目** 11 次，类型都保持 **文本**，逐条填：

| 键（Key） | 值（Value） |
| --- | --- |
| `id` | 变量 `记录ID` |
| `user_key` | 手打你的同步口令，例如 `wo-de-time-record-2026` |
| `date` | 变量 `日期` |
| `start_time` | 变量 `开始HHMM` |
| `end_time` | 变量 `结束HHMM` |
| `title` | 变量 **二级分类** |
| `category` | 变量 **一级分类** |
| `color` | 手打 `blue`（想按分类配色见文末附录） |
| `note` | 变量 **二级分类** + 空格 + 手打 `已完成` |
| `created_at` | 变量 `时间戳` |
| `updated_at` | 变量 `时间戳` |

⚠️ 键名必须是上面这些**英文小写**，一个字母都不能差。

⚠️ `title` 只放二级分类，**不要**把「30 分钟」拼进去。日历标题该带分钟数照带，但数据库里带了的话，洞悉会把「阅读 30 分钟」和「阅读 45 分钟」当成两个不同任务，饼图和排行就碎了。时长网站会自己用起止时间算。

### B9. 获取 URL 内容 → 发出去

- 搜索添加：**获取 URL 内容**（英文 Get Contents of URL）
- 最上面的 URL 栏填：

  ```
  https://你的项目.supabase.co/rest/v1/events
  ```

  （把 `你的项目` 换成 A3 抄的那串，结尾的 `/rest/v1/events` 一定要有）
- 点动作里的 **显示更多**（展开高级选项）
- **方法** 改成 **POST**
- **头部**：点「添加新头部」四次，填：

  | 键 | 值 |
  | --- | --- |
  | `apikey` | 粘贴你的 anon key |
  | `Authorization` | `Bearer ` + 粘贴 anon key（Bearer 后面**有一个空格**） |
  | `Content-Type` | `application/json` |
  | `Prefer` | `resolution=merge-duplicates,return=minimal` |

- **请求体** 选 **文件**，下面的空格里选上一步的 **词典** 变量

  > 也可以选「JSON」然后一个键一个键地填，但那样要填 11 遍、还容易漏；用「文件 + 词典」快捷指令会自动帮你序列化成 JSON，中文也不会乱码。

到这里就完成了。**结束分支现在一共比原来多 9 个动作，全在通知之后。**

### B10.（可选，但建议）失败时提醒自己

在 B9 下面再加：

- **如果** → 条件：`获取 URL 内容` **没有任何值**
  - 里面放一个 **显示通知**：`云端上传失败，稍后打开网站点一次同步`
- **结束如果**

网络不好的时候日历那条已经写好了，不会丢，只是云端要补。

---

## C. 改「补录」分支

补录分支已经有「开始时间」「结束时间」「日程内容」「first选择」这几个变量，所以做法几乎一样。

找到补录分支最后那个 **添加新的日历事件**（创建日程的动作），在它**下面**把 B1–B9 原样再做一遍，只有四处不同：

| 步骤 | 结束分支 | 补录分支改成 |
| --- | --- | --- |
| B4 / B5 的日期来源 | 变量 `结束时间` | 用 **当前日期**（补录这个动作发生的时刻） |
| 词典 `title` | 变量 `二级分类` | 变量 **日程内容** |
| 词典 `category` | 变量 `一级分类` | 变量 **first选择** |
| 词典 `note` | `二级分类 已完成` | 手打 `补录`，或者留空 |

`date` / `start_time` / `end_time` 仍然用**用户输入的那对起止时间**（B1–B3 不变），不然补录的就记到今天头上了。

> 如果嫌重复：可以把 B1–B9 单独存成一个新快捷指令（比如叫 `上传到看板`，接收 5 个输入），然后在两个分支里各调用一次。不熟悉「快捷指令输入」的话，老老实实复制一遍更省事 —— 长按动作可以多选、复制、粘贴。

---

## D. 验一遍

1. 手机上运行 `time record 1` → **开始** → 随便选一个分类 → 等 1 分钟。
2. 再运行一次 → **结束**。应该照常弹「恭喜你完成…」的通知。
3. 打开 Supabase → 左侧 **Table Editor** → `events` 表 → 应该多了一行，`title` 是你的二级分类，`start_time` / `end_time` 对得上。
4. 打开看板网站 → **今天**。那一块应该已经在了（网站进页会自动拉取，不用手点）。
5. 切到 **洞悉** → 饼图和趋势里应该已经算上这一段时长。
6. 打开 **日历 App** → 那条日程照样在，标题还是「二级分类 N 分钟」。

六条全对 = 打通了。

---

## E. 出问题看这里

| 现象 | 原因 | 怎么修 |
| --- | --- | --- |
| 快捷指令报错，提示 401 / `Invalid API key` | anon key 抄漏了，或 `Authorization` 里忘了 `Bearer ` 和那个空格 | 重新复制 A3 的 key |
| 报错 404 / `relation "public.events" does not exist` | 建表 SQL 没跑成功 | 回 A2 重跑一次 |
| 报错 401 / 403 提到 `row-level security` | policy 那段没跑到 | 回 A2 重跑整段（含 `create policy`） |
| 报错 400 提到 `null value in column "id"` | 词典里 `id` 的值是空的 | 检查 B7 的文本动作和变量名 |
| Supabase 里有数据，网站看不到 | 两边 `user_key` 不一致 | 网站「更多 → 云同步 → 设置」里的口令，和 B8 词典里手打的那串改成完全一样 |
| 网站提示「无法连接服务器」 | URL 填成 dashboard 网址了 | 必须是 `https://xxxx.supabase.co/rest/v1/events` |
| 网站提示「同步失败」但没说原因 | 不会出现了 —— 现在都会写明具体原因 | 按提示对应上面几行处理 |
| 同一条被记了两次 | 结束分支跑了两遍，两次的 `id` 不同 | 在网站或 Supabase 里删掉多的那条 |

---

## 附录：按一级分类配颜色（可选）

嫌全是蓝色单调的话，B8 词典里的 `color` 别写死 `blue`，改成这样：

1. 在 B8 **之前**插入一个 **词典** 动作，内容：

   | 键 | 值 |
   | --- | --- |
   | English | blue |
   | Chinese | red |
   | Politics | indigo |
   | Health | green |
   | Study | purple |
   | Daily | sand |
   | relax | mint |
   | Todolist | gray |

2. 紧接着加 **获取词典值**：从上一步的词典里取 键 = 变量 **一级分类** → 结果重命名为 `颜色`
3. B8 里 `color` 的值改成变量 `颜色`

可用颜色名（写别的会被当成蓝色，也可以直接写 `#RRGGBB`）：

```
blue sky cyan teal seafoam mint green sage
gold yellow sand orange peach coral red wine
blush pink mauve purple lilac indigo brown slate gray
```
