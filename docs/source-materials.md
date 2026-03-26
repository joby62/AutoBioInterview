# Source Materials

## 原始来源

- 源文件：`/Users/lijiabo/Desktop/云南十天（昆明大理泸沽湖丽江香格里拉）(4).docx`
- 当前站点：`static/guide/yunnan.html`
- 当前数据脚本：`static/guide/yunnan.js`

## 已提取素材包

- 目录：`static/guide/source/yunnan_trip_v4`
- 生成脚本：`scripts/extract_docx_bundle.py`

## 素材包内容

- `document.md`
  按阅读顺序穿插了正文和图片引用，适合人工通读。
- `document.txt`
  纯文本版本，图片位置会显示占位引用。
- `manifest.json`
  机器可读的引用清单，包含图片顺序、原始文件名、所在段落、前后文。
- `images/`
  从 docx 中提取出的图片文件，目前共 48 张，文件名已按文档出现顺序重命名。

## 当前提取结果

- 段落数：376
- 图片引用数：48
- 图片命名方式：`image-001` 到 `image-048`

## 后续页面使用建议

- `document.md` 用于人工整理每一天的图文节奏。
- `manifest.json` 用于前端建立 “图片 -> 段落 -> 天数” 的引用关系。
- `images/` 用于做每天封面图、图廊图和灯箱图。
- `document.txt` 用于搜索兜底或生成关键词索引。

## 注意点

- 很多图片在原文中是单独占一段，因此页面里不应该只把它们当装饰图。
- 同一天经常有多张图，适合做图廊而不是只放一张示意图。
- 现有 `yunnan.js` 里的 `dayData` 是摘要版，不等于原文内容，后续必须和素材包做映射。
