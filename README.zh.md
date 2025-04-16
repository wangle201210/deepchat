<p align='center'>
<img src='./build/icon.png' width="150" height="150" alt="logo" />
</p>

<h1 align="center">DeepChat</h1>

<p align="center">海豚是鲸鱼的好朋友，DeepChat是你的好助手</p>

<div align="center">
  中文 / <a href="./README.md">English</a>/ <a href="./README.jp.md">日本語</a>
</div>

### 深度思考

<p align='center'>
<img src='./build/screen.zh.jpg'/>
</p>

### 支持搜索 (纯本地直接向搜索引擎发起)

<p align='center'>
<img src='./build/screen.search.zh.jpg'/>
</p>

### Latex 公式支持

<p align='center'>
<img src='./build/screen.latex.jpg'/>
</p>

### Artifacts 特性

<p align='center'>
<img src='./build/screen.artifacts.jpg'/>
</p>

## 主要特性

- 🌐 支持多个模型云服务：DeepSeek、OpenAI、硅基流动、Grok、Gemini、Anthropic 等
- 🏠 支持本地模型部署：Ollama，完整的管理能力，无需敲命令就能控制和管理 Ollama 下载、部署、运行模型
- 🚀 易用丰富的对话能力
  - 完整的 Markdown 渲染，优秀的代码模块渲染
  - 天然支持多路会话同时进行，无需等待模型生成结束就可以开启新的会话，效率Max
  - 支持 Artifacts 渲染，丰富的多样化结果展示，并且 MCP 化后大大节约了 token 消耗
  - 消息支持重试产生多个变体，会话可以随意分叉，总有一种思路适合你
  - 支持渲染图片，Mermaid表格等多模内容，支持 Gemini 文生图能力
  - 支持在内容中标记出搜索等外部信息源
- 🔍 毫无短板的搜索扩展能力
  - 通过 MCP 的模式内置了 Brave 和博查等业界优秀的搜索 API，模型自行判断智能搜索
  - 通过模拟用户阅读网页支持了 Google/Bing/Baidu/搜狗公众号搜索等主流搜索引擎，让大模型像人类一样阅读搜索引擎
  - 支持任意搜索引擎的阅读，只需要配置一个搜索助手模型，就可以接入各种搜索，无论是内网还是缺少API或者是垂直领域的搜索引擎都可以尝试成为模型的信息来源
- 🔧 优秀的 MCP 支持
  - 易用性极强的配置界面
  - 美观清晰的工具调用展示
  - 详细的工具调用调试窗口，自动格式化工具参数和返回数据
  - 内置 Node 运行环境，npx类服务环境免配置
  - 支持 StreamableHTTP/SSE/Stdio
  - 支持 inMemory 服务，内置代码运行、网页信息获取以及文件操作等实用工具，大部分日常使用场景无需二次安装开箱即用
  - 通过内置 MCP 服务把视觉模型视觉能力转换成任意模型都可实用的通用能力
- 💻 支持多平台：Windows、macOS、Linux
- 🎨 美观易用的界面，面向用户的设计，精心配色的明暗主题
- 🔗 丰富的 DeepLink ，可以通过一个链接发起会话，无缝集成到其他应用。也可以一键安装 MCP 服务，简单快捷。
- 🚑 安全优先的设计，会话数据和配置数据都预留了加密接口和代码混淆能力
- 🛡️ 隐私保护，支持投屏隐藏，网络代理等隐私保护方式，降低信息泄漏的可能
- 💰 商业友好，拥抱开源，基于 Apache License 2.0 协议

## 目前支持的模型供应商

<table>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/ollama.svg" width="50" height="50"><br/>
      <a href="https://ollama.com">Ollama</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/deepseek-color.svg" width="50" height="50"><br/>
      <a href="https://deepseek.com/">Deepseek（深度求索）</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/siliconcloud.svg" width="50" height="50"><br/>
      <a href="https://www.siliconflow.cn/">硅基流动</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/qwen-color.svg" width="50" height="50"><br/>
      <a href="https://chat.qwenlm.ai">QwenLM</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/doubao-color.svg" width="50" height="50"><br/>
      <a href="https://console.volcengine.com/ark/">火山引擎</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/minimax-color.svg" width="50" height="50"><br/>
      <a href="https://minimaxi.com/">MiniMax大模型</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/fireworks-color.svg" width="50" height="50"><br/>
      <a href="https://fireworks.ai/">Fireworks</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/ppio-color.svg" width="50" height="50"><br/>
      <a href="https://ppinfra.com/">PPIO派欧云</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/openai.svg" width="50" height="50"><br/>
      <a href="https://openai.com/">OpenAI</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/gemini-color.svg" width="50" height="50"><br/>
      <a href="https://gemini.google.com/">Gemini</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/github.svg" width="50" height="50"><br/>
      <a href="https://github.com/marketplace/models">GitHub Models</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/moonshot.svg" width="50" height="50"><br/>
      <a href="https://moonshot.ai/">Moonshot</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/openrouter.svg" width="50" height="50"><br/>
      <a href="https://openrouter.ai/">OpenRouter</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/azure-color.svg" width="50" height="50"><br/>
      <a href="https://azure.microsoft.com/en-us/products/ai-services/openai-service">Azure OpenAI</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/qiniu.svg" width="50" height="50"><br/>
      <a href="https://www.qiniu.com/products/ai-token-api">七牛云</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/grok.svg" width="50" height="50"><br/>
      <a href="https://x.ai/">Grok</a>
    </td>
  </tr>
</table>

### 兼容任意 OpenAI/Gemini/Anthropic API格式的供应商
## 其他特性

- 支持 Ollama 本地模型管理
- 支持本地文件处理
- Artifacts 支持
- 自定义任意搜索引擎（通过模型解析，无需API适配）
- MCP支持（内置npx，无需额外安装node环境）
- 多模态模型支持
- 本地聊天数据备份与恢复
- 支持OpenAi、Gemini、Anthropic三种格式的任意模型提供方

## 开发

请先阅读 [贡献指南](./CONTRIBUTING.zh.md)
Windows 和 Linux 由 Github Action 打包
Mac相关签名打包查看 [Mac 打包指南](https://github.com/ThinkInAIXYZ/deepchat/wiki/Mac-%E6%89%93%E5%8C%85%E6%8C%87%E5%8D%97)

### 安装依赖

```bash
$ npm install
$ npm run installRuntime
# if got err: No module named 'distutils'
$ pip install setuptools
# for windows x64
$ npm install --cpu=x64 --os=win32 sharp
# for mac apple silicon
$ npm install --cpu=arm64 --os=darwin sharp
# for mac intel
$ npm install --cpu=x64 --os=darwin sharp
# for linux x64
$ npm install --cpu=x64 --os=linux sharp
```

### 开始开发

```bash
$ npm run dev
```

### 构建

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux

# 指定架构打包
$ npm run build:win:x64
$ npm run build:win:arm64
$ npm run build:mac:x64
$ npm run build:mac:arm64
$ npm run build:linux:x64
$ npm run build:linux:arm64
```

## Star

[![Star History Chart](https://api.star-history.com/svg?repos=ThinkInAIXYZ/deepchat&type=Timeline)](https://www.star-history.com/#ThinkInAIXYZ/deepchat&Timeline)

## 贡献者列表

感谢所有参与建设deepchat的贡献者！如果你也想参与，请阅读 [贡献指南](./CONTRIBUTING.md)。

<a href="https://github.com/ThinkInAIXYZ/deepchat/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ThinkInAIXYZ/deepchat" />
</a>

# 📃 许可证

[LICENSE](./LICENSE)
