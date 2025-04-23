<p align='center'>
<img src='./build/icon.png' width="150" height="150" alt="DeepChat AI助手图标" />
</p>

<h1 align="center">DeepChat - 强大的开源多模型AI聊天平台</h1>

<p align="center">DeepChat是一个功能丰富的开源AI聊天平台，支持多种云端和本地大语言模型，提供强大的搜索增强和工具调用能力。</p>

<p align="center">
  <a href="https://github.com/ThinkInAIXYZ/deepchat/stargazers"><img src="https://img.shields.io/github/stars/ThinkInAIXYZ/deepchat" alt="Stars Badge"/></a>
  <a href="https://github.com/ThinkInAIXYZ/deepchat/network/members"><img src="https://img.shields.io/github/forks/ThinkInAIXYZ/deepchat" alt="Forks Badge"/></a>
  <a href="https://github.com/ThinkInAIXYZ/deepchat/pulls"><img src="https://img.shields.io/github/issues-pr/ThinkInAIXYZ/deepchat" alt="Pull Requests Badge"/></a>
  <a href="https://github.com/ThinkInAIXYZ/deepchat/issues"><img src="https://img.shields.io/github/issues/ThinkInAIXYZ/deepchat" alt="Issues Badge"/></a>
  <a href="https://github.com/ThinkInAIXYZ/deepchat/blob/main/LICENSE"><img src="https://img.shields.io/github/license/ThinkInAIXYZ/deepchat" alt="License Badge"/></a>
</p>

<div align="center">
  <a href="./README.zh.md">中文</a> / <a href="./README.md">English</a> / <a href="./README.jp.md">日本語</a>
</div>

## 📑 目录

- [项目简介](#-项目简介)
- [为什么选择DeepChat](#-为什么选择deepchat)
- [功能展示](#-功能展示)
- [主要功能](#-主要功能)
- [支持的模型提供商](#-支持的模型提供商)
- [使用场景](#-使用场景)
- [快速开始](#-快速开始)
- [开发指南](#-开发指南)
- [社区与贡献](#-社区与贡献)
- [许可证](#-许可证)

## 🚀 项目简介

DeepChat是一个功能强大的开源AI聊天平台，为用户提供与多种大语言模型交互的统一界面。无论是云端API如OpenAI、Gemini、Anthropic，还是本地部署的Ollama模型，DeepChat都能提供流畅的用户体验。

作为一个跨平台的AI助手应用，DeepChat不仅支持基础的聊天功能，还提供了搜索增强、工具调用、多模态交互等高级特性，让AI能力的应用更加便捷和高效。

## 💡 为什么选择DeepChat

与其他AI聊天工具相比，DeepChat具有以下独特优势：

- **多模型统一管理**：一个应用支持几乎所有主流LLM，无需在多个应用间切换
- **本地模型无缝集成**：内置Ollama支持，无需命令行操作即可管理和使用本地模型
- **强大的搜索增强**：支持多种搜索引擎，让AI回答更加准确和及时
- **高级工具调用**：内置MCP支持，无需额外配置即可使用代码执行、网络访问等工具
- **注重隐私保护**：本地数据存储，支持网络代理，减少信息泄露风险
- **开源友好**：基于Apache License 2.0协议，适合商业和个人使用

## 📸 功能展示

### 推理能力

<p align='center'>
<img src='./build/screen.jpg' alt="DeepChat AI聊天界面与推理功能展示"/>
</p>

### 搜索增强

<p align='center'>
<img src='./build/screen.search.jpg' alt="DeepChat搜索增强功能展示"/>
</p>

### LaTeX支持

<p align='center'>
<img src='./build/screen.latex.jpg' alt="DeepChat LaTeX公式渲染功能展示"/>
</p>

### Artifacts支持

<p align='center'>
<img src='./build/screen.artifacts.jpg' alt="DeepChat Artifacts多媒体渲染功能展示"/>
</p>

## 🔥 主要功能

- 🌐 **多种云端LLM提供商支持**：DeepSeek、OpenAI、Silicon Flow、Grok、Gemini、Anthropic等
- 🏠 **本地模型部署支持**：
  - 集成Ollama，提供全面的管理功能
  - 无需命令行操作即可控制和管理Ollama模型的下载、部署和运行
- 🚀 **丰富易用的聊天功能**
  - 完整的Markdown渲染，代码块显示优秀
  - 原生支持同时进行多会话对话；无需等待模型生成完成即可开始新会话，最大化效率
  - 支持Artifacts渲染，多样化结果展示，MCP集成后显著节省token消耗
  - 消息支持重试生成多个变体；对话可自由分支，确保总有合适的思路
  - 支持渲染图像、Mermaid图表等多模态内容；包含Gemini的文本到图像功能
  - 支持在内容中高亮显示搜索结果等外部信息源
- 🔍 **强大的搜索扩展能力**
  - 通过MCP模式内置集成Brave Search等领先搜索API，让模型智能决定何时搜索
  - 通过模拟用户网页浏览，支持Google、Bing、百度、搜狗公众号搜索等主流搜索引擎，使LLM能像人类一样阅读搜索引擎
  - 支持读取任何搜索引擎；只需配置搜索助手模型，即可连接各种搜索源，无论是内部网络、无API的引擎，还是垂直领域搜索引擎，作为模型的信息源
- 🔧 **出色的MCP（模型控制平台）支持**
  - 极其用户友好的配置界面
  - 美观清晰的工具调用显示
  - 详细的工具调用调试窗口，自动格式化工具参数和返回数据
  - 内置Node.js运行环境；类似npx的服务无需额外配置
  - 支持StreamableHTTP/SSE/Stdio协议
  - 支持inMemory服务，内置代码执行、网络信息获取、文件操作等实用工具；开箱即用，无需二次安装即可满足大多数常见用例
  - 通过内置MCP服务，将视觉模型能力转换为任何模型都可通用的函数
- 💻 **多平台支持**：Windows、macOS、Linux
- 🎨 **美观友好的界面**，以用户为中心的设计，精心设计的明暗主题
- 🔗 **丰富的DeepLink支持**：通过链接发起对话，与其他应用无缝集成。还支持一键安装MCP服务，简单快速
- 🚑 **安全优先设计**：聊天数据和配置数据预留加密接口和代码混淆能力
- 🛡️ **隐私保护**：支持屏幕投影隐藏、网络代理等隐私保护方法，降低信息泄露风险
- 💰 **商业友好**，拥抱开源，基于Apache License 2.0协议

## 🤖 支持的模型提供商

<table>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/ollama.svg" width="50" height="50" alt="Ollama图标"><br/>
      <a href="https://ollama.com">Ollama</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/deepseek-color.svg" width="50" height="50" alt="Deepseek图标"><br/>
      <a href="https://deepseek.com/">Deepseek</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/siliconcloud.svg" width="50" height="50" alt="Silicon图标"><br/>
      <a href="https://www.siliconflow.cn/">Silicon</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/qwen-color.svg" width="50" height="50" alt="QwenLM图标"><br/>
      <a href="https://chat.qwenlm.ai">QwenLM</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/doubao-color.svg" width="50" height="50" alt="Doubao图标"><br/>
      <a href="https://console.volcengine.com/ark/">Doubao</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/minimax-color.svg" width="50" height="50" alt="MiniMax图标"><br/>
      <a href="https://platform.minimaxi.com/">MiniMax</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/fireworks-color.svg" width="50" height="50" alt="Fireworks图标"><br/>
      <a href="https://fireworks.ai/">Fireworks</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/ppio-color.svg" width="50" height="50" alt="PPIO图标"><br/>
      <a href="https://ppinfra.com/">PPIO</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/openai.svg" width="50" height="50" alt="OpenAI图标"><br/>
      <a href="https://openai.com/">OpenAI</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/gemini-color.svg" width="50" height="50" alt="Gemini图标"><br/>
      <a href="https://gemini.google.com/">Gemini</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/github.svg" width="50" height="50" alt="GitHub Models图标"><br/>
      <a href="https://github.com/marketplace/models">GitHub Models</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/moonshot.svg" width="50" height="50" alt="Moonshot图标"><br/>
      <a href="https://moonshot.ai/">Moonshot</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/openrouter.svg" width="50" height="50" alt="OpenRouter图标"><br/>
      <a href="https://openrouter.ai/">OpenRouter</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/azure-color.svg" width="50" height="50" alt="Azure OpenAI图标"><br/>
      <a href="https://azure.microsoft.com/en-us/products/ai-services/openai-service">Azure OpenAI</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/qiniu.svg" width="50" height="50" alt="Qiniu图标"><br/>
      <a href="https://www.qiniu.com/products/ai-token-api">Qiniu</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/grok.svg" width="50" height="50" alt="Grok图标"><br/>
      <a href="https://x.ai/">Grok</a>
    </td>
  </tr>
</table>

### 兼容任何OpenAI/Gemini/Anthropic API格式的模型提供商

## 🔍 使用场景

DeepChat适用于多种AI应用场景：

- **日常助手**：回答问题、提供建议、辅助写作和创作
- **开发辅助**：代码生成、调试、技术问题解答
- **学习工具**：概念解释、知识探索、学习辅导
- **内容创作**：文案撰写、创意激发、内容优化
- **数据分析**：数据解读、图表生成、报告撰写

## 📦 快速开始

### 下载安装

从[GitHub Releases](https://github.com/ThinkInAIXYZ/deepchat/releases)页面下载适合您系统的最新版本：

- Windows: `.exe`安装文件
- macOS: `.dmg`安装文件
- Linux: `.AppImage`或`.deb`安装文件

### 配置模型

1. 启动DeepChat应用
2. 点击设置图标
3. 选择"模型提供商"选项卡
4. 添加您的API密钥或配置本地Ollama

### 开始对话

1. 点击"+"按钮创建新对话
2. 选择您想使用的模型
3. 开始与AI助手交流

## 💻 开发指南

请阅读[贡献指南](./CONTRIBUTING.md)

Windows和Linux通过GitHub Action打包。
对于Mac相关的签名和打包，请参考[Mac发布指南](https://github.com/ThinkInAIXYZ/deepchat/wiki/Mac-Release-Guide)。

### 安装依赖

```bash
$ npm install
$ npm run installRuntime
# 如果出现错误：No module named 'distutils'
$ pip install setuptools
# 对于Windows x64
$ npm install --cpu=x64 --os=win32 sharp
# 对于Mac Apple Silicon
$ npm install --cpu=arm64 --os=darwin sharp
# 对于Mac Intel
$ npm install --cpu=x64 --os=darwin sharp
# 对于Linux x64
$ npm install --cpu=x64 --os=linux sharp
```

### 开始开发

```bash
$ npm run dev
```

### 构建

```bash
# Windows
$ npm run build:win

# macOS
$ npm run build:mac

# Linux
$ npm run build:linux

# 指定架构打包
$ npm run build:win:x64
$ npm run build:win:arm64
$ npm run build:mac:x64
$ npm run build:mac:arm64
$ npm run build:linux:x64
$ npm run build:linux:arm64
```

## 👥 社区与贡献

DeepChat是一个活跃的开源社区项目，我们欢迎各种形式的贡献：

- 🐛 [报告问题](https://github.com/ThinkInAIXYZ/deepchat/issues)
- 💡 [提交功能建议](https://github.com/ThinkInAIXYZ/deepchat/issues)
- 🔧 [提交代码改进](https://github.com/ThinkInAIXYZ/deepchat/pulls)
- 📚 [完善文档](https://github.com/ThinkInAIXYZ/deepchat/wiki)
- 🌍 [帮助翻译](https://github.com/ThinkInAIXYZ/deepchat/tree/main/locales)

查看[贡献指南](./CONTRIBUTING.md)了解更多参与项目的方式。

## ⭐ Star历史

[![Star History Chart](https://api.star-history.com/svg?repos=ThinkInAIXYZ/deepchat&type=Timeline)](https://www.star-history.com/#ThinkInAIXYZ/deepchat&Timeline)

## 👨‍💻 贡献者

感谢您考虑为deepchat做出贡献！贡献指南可以在[贡献指南](./CONTRIBUTING.md)中找到。

<a href="https://github.com/ThinkInAIXYZ/deepchat/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ThinkInAIXYZ/deepchat" alt="DeepChat项目贡献者" />
</a>

## 📃 许可证

[LICENSE](./LICENSE)
