# Markdown 支持规范

本文档详细列出了应用程序应支持的Markdown功能模块。

## 核心功能 (CommonMark 规范)

### 块级元素

- **段落** (Paragraphs) - 基本文本块，由空行分隔
- **标题** (Headings) - 支持6级标题 (#, ##, ###, ####, #####, ######)
- **引用块** (Blockquotes) - 使用 > 开头的引用文本
- **列表**
  - 无序列表 (Unordered lists) - 使用 \*, -, + 开头的项目
  - 有序列表 (Ordered lists) - 使用数字和句点开头的项目
- **代码块**
  - 缩进代码块 (Indented code blocks) - 使用4个空格或1个制表符缩进
  - 围栏代码块 (Fenced code blocks) - 使用 ``` 或 ~~~ 包围，支持语言标识
- **水平分割线** (Thematic breaks) - 使用 \*\*\*, ---, \_\_\_ 创建

### 行内元素

- **强调** (Emphasis) - 使用 \* 或 \_ 包围的斜体文本
- **加粗** (Strong emphasis) - 使用 \*\* 或 \_\_ 包围的粗体文本
- **代码** (Code spans) - 使用 ` 包围的行内代码
- **链接** (Links)
  - 内联链接 (Inline links) - [文本](URL '可选标题')
  - 引用链接 (Reference links) - [文本][标识符]
  - 自动链接 (Autolinks) - <URL> 或 <email>
- **图片** (Images) - ![替代文本](URL '可选标题')
- **硬换行** (Hard line breaks) - 行尾使用两个或多个空格，或反斜杠 \

## 扩展功能 (GFM 和常见扩展)

### 块级扩展

- **表格** (Tables) - 使用 | 和 - 创建的简单表格
- **任务列表** (Task lists) - 使用 - [ ] 和 - [x] 的可勾选项目
- **围栏代码块扩展** - 支持更多语言和语法高亮选项
- **定义列表** (Definition lists) - 术语和定义的列表
- **脚注** (Footnotes) - 使用 [^1] 的引用注释
- **警告块** (Admonitions) - 用于信息、警告、注意等特殊块

### 行内扩展

- **删除线** (Strikethrough) - 使用 ~~ 包围的文本
- **高亮** (Highlight) - 使用 == 包围的文本
- **上标** (Superscript) - 使用 ^ 包围的文本
- **下标** (Subscript) - 使用 ~ 包围的文本
- **缩写** (Abbreviations) - 定义缩写术语
- **表情符号** (Emoji) - 支持 :emoji: 语法
- **自动链接扩展** - 增强对URL的自动识别能力

## 数学和图表

- **数学公式**
  - 行内公式 - $...$, \(...\), 或 $$...$$
  - 块级公式 - $$...$$, \[...\]
- **图表**
  - Mermaid 图表
  - PlantUML 图表
  - 其他图表语法

## 其他高级特性

- **元数据** (YAML Front Matter) - 文档头部的元数据定义
- **目录** (Table of Contents) - 自动生成的目录
- **自定义容器** (Custom containers) - 特殊用途的自定义块
- **导入文件** (File inclusion) - 允许导入其他文件内容
- **内部引用** (Internal references) - 文档内部章节和元素引用
- **自定义属性** (Custom attributes) - 为元素添加id、类或属性

## 实现注意事项

- 所有核心功能应优先实现
- GFM扩展功能应作为第二优先级实现
- 数学公式和图表等特殊功能应根据实际需求实现
- 应注意不同元素的嵌套规则和边界情况
- 应确保与现有CommonMark和GFM解析器的最大兼容性

## 开发路线图

1. 实现所有核心功能 (CommonMark规范)
2. 实现GFM扩展功能 (表格、任务列表、删除线等)
3. 实现数学公式支持
4. 实现高级图表和特殊语法
5. 实现自定义功能和UI增强
