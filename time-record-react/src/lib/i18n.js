/* ============================================================
   1b. I18N  (English / 中文) — ported verbatim from legacy app.js
   ------------------------------------------------------------
   The legacy app kept the active language in a module-level
   `appLang` binding that every render function read directly.
   That behaviour is preserved here: `setLang()` updates the same
   module-level binding, and React re-renders are driven by the
   `lang` state in useAppData.
   ============================================================ */

import { MONTHS_SHORT, MONTHS_LONG, WEEKDAYS, ZH_WEEKDAYS } from './constants.js';
import { parseISO } from './date.js';

let appLang = 'en'; // 'en' | 'zh'

export function getLang() { return appLang; }

export function setLang(lang) {
  appLang = (lang === 'zh' || lang === 'en') ? lang : 'en';
  return appLang;
}

export const I18N = {
  en: {
    calendar: 'Calendar', today: 'Today', insights: 'Insights', more: 'More',
    selectDate: 'Select Date', prevMonth: 'Previous month', nextMonth: 'Next month',
    prevYear: 'Previous year', nextYear: 'Next year',
    noEvents: 'No events', addEventCta: 'Add event', todayChip: 'Today', nowChip: 'Now',
    eventsChip: '%n events', oneEventChip: '1 event', noEventsChip: 'No events',
    data: 'Data', dataDesc: 'Export, import or clear the events stored on this device.',
    events: 'Events', templates: 'Templates', size: 'Size',
    export: 'Export', import: 'Import', clearAll: 'Clear all',
    storageKeys: 'Storage keys', key: 'Key', entries: 'Entries',
    about: 'About', aboutDesc: 'Calendar v1.0 — a local-first calendar.',
    eventTemplates: 'Event Templates', templatesDefined: '%n defined',
    storage: 'Storage', onThisDevice: 'On this device', limitedPreview: 'Limited (preview)',
    aboutCalendar: 'About Calendar', version: 'v1.0',
    language: 'Language', languageDesc: 'Switch the interface language.',
    english: 'English', chinese: '中文',
    cancel: 'Cancel', done: 'Done', save: 'Save', add: 'Add', delete: 'Delete', clear: 'Clear',
    addEvent: 'Add Event', newEvent: 'New Event', editEvent: 'Edit Event',
    title: 'Title', date: 'Date', start: 'Start', end: 'End', category: 'Category', color: 'Color', note: 'Note',
    titlePlaceholder: 'e.g. CET-6 Reading', categoryPlaceholder: 'e.g. English', notePlaceholder: 'Optional',
    titleRequired: 'Please enter a title.',
    deleteEvent: 'Delete Event', deleteEventTitle: 'Delete event?', deleteEventMsg: 'will be permanently removed.',
    eventSaved: 'Event saved', eventAdded: 'Event added', eventDeleted: 'Event deleted',
    clearAllTitle: 'Clear all data?', clearAllMsg: 'All events on this device will be permanently removed.',
    dataCleared: 'All data cleared',
    exported: 'Exported %n events', noExport: 'No events to export', imported: 'Imported %n events', importFailed: 'Import failed — not valid JSON',
    newTemplate: 'New Template', editTemplate: 'Edit Template', addTemplate: 'Add Template',
    name: 'Name', namePlaceholder: 'e.g. English',
    templatesHint: 'Templates appear as quick picks when adding an event.',
    noTemplates: 'No templates yet. Add one to reuse it when creating events.',
    templateSaved: 'Template saved', templateAdded: 'Template added', templateDeleted: 'Template deleted',
    deleteTemplateTitle: 'Delete template?', deleteTemplateMsg: 'will be removed. Existing events keep their color.',
    eventsUsed: '%n events', oneEventUsed: '1 event',
    storageMsg: 'Backend: localStorage\n\ncalendar_events_v1 — %n events (%s)\ncalendar_categories_v1 — %m templates\n\n%mode',
    aboutMsg: 'Version 1.0 — a local-first calendar.\n\nData is stored on this device. The data layer is architected for a future Supabase backend and Apple Shortcuts import.',
    segDay: 'Day', segWeek: 'Week', segMonth: 'Month', segYear: 'Year',
    importGuide: 'Import from Shortcuts',
    importGuideDesc: 'Build a Shortcut that sends today\u2019s calendar events straight into this app \u2014 one tap, no typing.',
    importGuideNote: 'Passing each event\u2019s calendar ID is what makes the Shortcut safe to run twice: re-importing the same ID updates that record instead of adding a duplicate.',
    guideStepsTitle: 'Shortcut steps',
    guideStep1: 'Find Calendar Events \u2014 filter Start Date is Today. Optionally sort by Start Date.',
    guideStep2: 'Repeat with Each \u2014 pass the events from step 1.',
    guideStep3: 'Inside the loop, add Text with exactly this content \u2014 insert each value with the Magic Variable picker:',
    guideFormatTitle: 'You need three Format Date actions',
    guideFormatDate: 'Start Date \u2192 Custom \u00b7 yyyy-MM-dd \u2014 used for date',
    guideFormatTime: 'Start Date and End Date \u2192 Custom \u00b7 HH:mm \u2014 used for startTime / endTime',
    guideFormatId: 'id must differ per event. Built from the date and the title here, so re-running updates rather than duplicating.',
    guideFormatWarn: 'The formats must match exactly. A wrong date falls back to today, and a wrong time to 09:00\u201310:00.',
    guideStep4: 'After the loop, add Combine Text with Repeat Results, separated by a comma.',
    guideStep5: 'Add Text and wrap the combined result in square brackets:',
    guideStep6: 'Add URL Encode on that text, then Open URLs with:',
    guideTipsTitle: 'Good to know',
    guideTip1: 'Safe to run more than once a day \u2014 records already imported are updated, not duplicated.',
    guideTip2: 'Only date and title are required. Missing times default to 09:00\u201310:00.',
    guideTip3: 'category becomes the Insights grouping. The calendar name works well here.',
    guideTip4: 'Comfortable up to roughly 20 events per tap.',
    guideCopy: 'Copy',
    guideCopied: 'Copied',
    sync: 'Sync', refresh: 'Refresh',
    appearance: 'Appearance',
    appearanceDesc: 'Tints buttons, links and the selected day. Event colours are unchanged.',
    themeGraphite: 'Graphite',
    themeBlue: 'Blue',
    themeSage: 'Sage',
    themeClay: 'Clay',
    themeLavender: 'Lavender',
    themeRose: 'Rose',
    guideModeDaily: 'Daily',
    guideModeBackfill: 'Backfill',
    guideBackfillDesc: 'Importing months of past events uses the same Shortcut \u2014 only step 1 changes. Build it once, then run it for one month at a time.',
    guideBackfillStep1: 'Find Calendar Events \u2014 remove the \u201cis Today\u201d filter and use a date range instead: Start Date is after \u00b7 and Start Date is before \u00b7. Set no limit, so nothing is cut off.',
    guideBackfillStep3: 'Run it once per month, changing the two dates each time. Import order does not matter.',
    guideBackfillWhy: 'Why one month at a time: every event travels inside the address, and Safari drops very long addresses. A month of events is comfortable; a whole year in one tap risks being silently truncated.',
    guideBackfillAlt: 'Already have the data in Numbers or a spreadsheet? Export it as JSON and use More \u203a Import instead \u2014 no length limit there.',
    dayBlocks: 'Time Blocks', noData: 'No data for this period',
    totalTime: 'Total Time', timeDistribution: 'Time Distribution', trend: 'Trend', history: 'History',
    sessionsTile: 'Sessions', avgSession: 'Average Session', avgShort: 'avg',
    firstRecorded: 'First Recorded', lastRecorded: 'Last Recorded', frequency: 'Frequency',
    shareOfTotal: 'of total time',
    topTasks: 'Top Tasks', tasksCount: '%n tasks', viewDetails: 'View Details', allCategories: 'All Categories',
    noSessions: 'No sessions in this period', back: 'Back',
    duration: 'Duration', event: 'Event', edit: 'Edit',
  },
  zh: {
    calendar: '日历', today: '今天', insights: '洞悉', more: '更多',
    selectDate: '选择日期', prevMonth: '上个月', nextMonth: '下个月',
    prevYear: '上一年', nextYear: '下一年',
    noEvents: '暂无日程', addEventCta: '添加日程', todayChip: '今天', nowChip: '现在',
    eventsChip: '%n 个日程', oneEventChip: '1 个日程', noEventsChip: '暂无日程',
    data: '数据', dataDesc: '导出、导入或清空此设备上保存的日程数据。',
    events: '日程', templates: '模板', size: '大小',
    export: '导出', import: '导入', clearAll: '清空全部',
    storageKeys: '存储 Key', key: 'Key', entries: '条目',
    about: '关于', aboutDesc: 'Calendar v1.0 — 本地优先的日历。',
    eventTemplates: '日程模板', templatesDefined: '已定义 %n 个',
    storage: '存储', onThisDevice: '此设备', limitedPreview: '受限（预览）',
    aboutCalendar: '关于 Calendar', version: 'v1.0',
    language: '语言', languageDesc: '切换界面语言。',
    english: 'English', chinese: '中文',
    cancel: '取消', done: '完成', save: '保存', add: '添加', delete: '删除', clear: '清空',
    addEvent: '添加日程', newEvent: '新建日程', editEvent: '编辑日程',
    title: '标题', date: '日期', start: '开始', end: '结束', category: '分类', color: '颜色', note: '备注',
    titlePlaceholder: '例如：CET-6 阅读', categoryPlaceholder: '例如：英语', notePlaceholder: '可选',
    titleRequired: '请输入标题。',
    deleteEvent: '删除日程', deleteEventTitle: '删除日程？', deleteEventMsg: '将被永久移除。',
    eventSaved: '已保存', eventAdded: '已添加', eventDeleted: '已删除',
    clearAllTitle: '清空全部数据？', clearAllMsg: '此设备上的所有日程将被永久移除。',
    dataCleared: '已清空全部数据',
    exported: '已导出 %n 个日程', noExport: '没有可导出的日程', imported: '已导入 %n 个日程', importFailed: '导入失败 — JSON 无效',
    newTemplate: '新建模板', editTemplate: '编辑模板', addTemplate: '添加模板',
    name: '名称', namePlaceholder: '例如：英语',
    templatesHint: '模板会在添加日程时作为快捷选项出现。',
    noTemplates: '暂无模板。添加一个以便在创建日程时复用。',
    templateSaved: '模板已保存', templateAdded: '模板已添加', templateDeleted: '模板已删除',
    deleteTemplateTitle: '删除模板？', deleteTemplateMsg: '将被移除。已有日程会保留其颜色。',
    eventsUsed: '%n 个日程', oneEventUsed: '1 个日程',
    storageMsg: '后端：localStorage\n\ncalendar_events_v1 — %n 个日程（%s）\ncalendar_categories_v1 — %m 个模板\n\n%mode',
    aboutMsg: '版本 1.0 — 本地优先的日历。\n\n数据存储在此设备上。数据层已为未来的 Supabase 后端与 Apple Shortcuts 导入做好架构。',
    segDay: '日', segWeek: '周', segMonth: '月', segYear: '年',
    importGuide: '从快捷指令导入',
    importGuideDesc: '搭建一个快捷指令，把当天的日历行程一键送进这个 App \u2014 无需手动输入。',
    importGuideNote: '传入每条行程的日历 ID，是快捷指令可以重复运行的关键：再次导入相同 ID 会更新该记录，而不是新增一条重复的。',
    guideStepsTitle: '快捷指令步骤',
    guideStep1: '查找日历事件 \u2014 筛选「开始日期」是「今天」。可再按开始日期排序。',
    guideStep2: '重复运算 \u2014 传入步骤 1 的事件。',
    guideStep3: '在循环内添加「文本」，内容如下 \u2014 每个值都用魔法变量选择器插入：',
    guideFormatTitle: '需要三个「格式化日期」动作',
    guideFormatDate: '开始日期 → 自定 · yyyy-MM-dd —— 供 date 使用',
    guideFormatTime: '开始日期、结束日期 → 自定 · HH:mm —— 供 startTime / endTime 使用',
    guideFormatId: 'id 必须每条不同。这里用「日期＋标题」拼成，重复运行会更新而不是新增。',
    guideFormatWarn: '格式必须完全一致。日期格式错误会回落到今天，时间格式错误会回落到 09:00\u201310:00。',
    guideStep4: '循环结束后，添加「合并文本」，用逗号分隔「重复结果」。',
    guideStep5: '添加「文本」，把合并结果用方括号包起来：',
    guideStep6: '对该文本执行「URL 编码」，然后用「打开 URL」：',
    guideTipsTitle: '注意事项',
    guideTip1: '一天可以多次运行 \u2014 已导入的记录会被更新，不会重复。',
    guideTip2: '只有 date 和 title 是必填。缺少时间时默认 09:00\u201310:00。',
    guideTip3: 'category 决定「洞悉」里的分类，填日历名称效果很好。',
    guideTip4: '单次约 20 条行程以内都很稳妥。',
    guideCopy: '复制',
    guideCopied: '已复制',
    sync: '同步', refresh: '刷新',
    appearance: '主题',
    appearanceDesc: '影响按钮、链接和选中日期的颜色。分类颜色不受影响。',
    themeGraphite: '石墨',
    themeBlue: '雾蓝',
    themeSage: '鼠尾草',
    themeClay: '陶土',
    themeLavender: '薰衣草',
    themeRose: '玫瑰',
    guideModeDaily: '每日',
    guideModeBackfill: '补录历史',
    guideBackfillDesc: '批量补录过去几个月的记录，用的是同一个快捷指令 — 只有第 1 步不同。建一次，然后按月分次运行。',
    guideBackfillStep1: '查找日历事件 — 去掉「是今天」这个筛选，改用日期区间：「开始日期」在…之后 · 且「开始日期」在…之前。不要设数量上限，以免被截断。',
    guideBackfillStep3: '每次改这两个日期，一个月运行一次。导入先后顺序不影响结果。',
    guideBackfillWhy: '为什么一次只导一个月：所有事件都塞在网址里传输，而 Safari 会丢弃过长的网址。一个月的量很宽裕；一次导一整年有被静默截断的风险。',
    guideBackfillAlt: '数据已经在 Numbers 或表格里了？把它导出成 JSON，改用「更多 › 导入」— 那条路没有长度限制。',
    dayBlocks: '时间块', noData: '该时段暂无数据',
    totalTime: '总时长', timeDistribution: '时间分布', trend: '趋势', history: '历史记录',
    sessionsTile: '次数', avgSession: '平均时长', avgShort: '平均',
    firstRecorded: '首次记录', lastRecorded: '最近记录', frequency: '使用频率',
    shareOfTotal: '占总时长',
    topTasks: '任务排行', tasksCount: '%n 个任务', viewDetails: '查看详情', allCategories: '全部分类',
    noSessions: '该时段暂无记录', back: '返回',
    duration: '时长', event: '日程', edit: '编辑',
  },
};

export function t(key, vars) {
  let s = (I18N[appLang] && I18N[appLang][key]) ? I18N[appLang][key] : (I18N.en[key] || key);
  if (vars) Object.keys(vars).forEach((k) => { s = s.split('%' + k).join(vars[k]); });
  return s;
}

export function monthName(m, long) {
  if (appLang === 'zh') return (m + 1) + '月';
  return long ? MONTHS_LONG[m] : MONTHS_SHORT[m];
}

export function weekdayName(i) { // i: 0 = Monday
  return appLang === 'zh' ? '周' + ZH_WEEKDAYS[i] : WEEKDAYS[i];
}

export function formatDayLabel(iso) {
  const { y, m, d } = parseISO(iso);
  if (appLang === 'zh') {
    const wd = (new Date(y, m, d).getDay() + 6) % 7;
    return (m + 1) + '月' + d + '日 ' + '星期' + ZH_WEEKDAYS[wd];
  }
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .format(new Date(y, m, d));
}

export function formatShortDate(iso) {
  const { y, m, d } = parseISO(iso);
  return appLang === 'zh' ? (m + 1) + '月' + d + '日' : MONTHS_SHORT[m] + ' ' + d + ', ' + y;
}
