<p align='center'>
<img src='./build/icon.png' width="150" height="150" alt="logo" />
</p>

<h1 align="center">DeepChat</h1>

<p align="center">Dolphins are good friends of whales, and DeepChat is your good assistant</p>

<div align="center">
  <a href="./README.zh.md">中文</a> / English / <a href="./README.jp.md">日本語</a>
</div>

### Reasoning

<p align='center'>
<img src='./build/screen.jpg'/>
</p>

### Search

<p align='center'>
<img src='./build/screen.search.jpg'/>
</p>

### Latex

<p align='center'>
<img src='./build/screen.latex.jpg'/>
</p>

### Artifacts support

<p align='center'>
<img src='./build/screen.artifacts.jpg'/>
</p>

## Main Features

- 🌐 Supports multiple cloud LLM providers: DeepSeek, OpenAI, Silicon Flow, Grok, Gemini, Anthropic, etc.
- 🏠 Supports local model deployment: Ollama, with comprehensive management capabilities, allowing control and management of Ollama model downloads, deployments, and runs without command-line operations.
- 🚀 Rich and easy-to-use chatbot capabilities
  - Complete Markdown rendering with excellent code block display.
  - Native support for simultaneous multi-session conversations; start new sessions without waiting for model generation to finish, maximizing efficiency.
  - Supports Artifacts rendering for diverse result presentation, significantly saving token consumption after MCP integration.
  - Messages support retry to generate multiple variations; conversations can be forked freely, ensuring there's always a suitable line of thought.
  - Supports rendering images, Mermaid diagrams, and other multi-modal content; includes Gemini's text-to-image capabilities.
  - Supports highlighting external information sources like search results within the content.
- 🔍 Robust search extension capabilities
  - Built-in integration with leading search APIs like Brave Search via MCP mode, allowing the model to intelligently decide when to search.
  - Supports mainstream search engines like Google, Bing, Baidu, and Sogou Official Accounts search by simulating user web browsing, enabling the LLM to read search engines like a human.
  - Supports reading any search engine; simply configure a search assistant model to connect various search sources, whether internal networks, API-less engines, or vertical domain search engines, as information sources for the model.
- 🔧 Excellent MCP (Model Controller Platform) support
  - Extremely user-friendly configuration interface.
  - Aesthetically pleasing and clear tool call display.
  - Detailed tool call debugging window with automatic formatting of tool parameters and return data.
  - Built-in Node.js runtime environment; npx-like services require no extra configuration.
  - Supports StreamableHTTP/SSE/Stdio protocols.
  - Supports inMemory services with built-in utilities like code execution, web information retrieval, and file operations; ready for most common use cases out-of-the-box without secondary installation.
  - Converts visual model capabilities into universally usable functions for any model via the built-in MCP service.
- 💻 Multi-platform support: Windows, macOS, Linux.
- 🎨 Beautiful and user-friendly interface, user-oriented design, meticulously themed light and dark modes.
- 🔗 Rich DeepLink support: Initiate conversations via links for seamless integration with other applications. Also supports one-click installation of MCP services for simplicity and speed.
- 🚑 Security-first design: Chat data and configuration data have reserved encryption interfaces and code obfuscation capabilities.
- 🛡️ Privacy protection: Supports screen projection hiding, network proxies, and other privacy protection methods to reduce the risk of information leakage.
- 💰 Business-friendly, embraces open source, based on the Apache License 2.0 protocol.

## Currently Supported Model Providers

<table>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/ollama.svg" width="50" height="50"><br/>
      <a href="https://ollama.com">Ollama</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/deepseek-color.svg" width="50" height="50"><br/>
      <a href="https://deepseek.com/">Deepseek</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/siliconcloud.svg" width="50" height="50"><br/>
      <a href="https://www.siliconflow.cn/">Silicon</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/qwen-color.svg" width="50" height="50"><br/>
      <a href="https://chat.qwenlm.ai">QwenLM</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/doubao-color.svg" width="50" height="50"><br/>
      <a href="https://console.volcengine.com/ark/">Doubao</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/minimax-color.svg" width="50" height="50"><br/>
      <a href="https://platform.minimaxi.com/">MiniMax</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/fireworks-color.svg" width="50" height="50"><br/>
      <a href="https://fireworks.ai/">Fireworks</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/ppio-color.svg" width="50" height="50"><br/>
      <a href="https://ppinfra.com/">PPIO</a>
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
      <a href="https://www.qiniu.com/products/ai-token-api">Qiniu</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/grok.svg" width="50" height="50"><br/>
      <a href="https://x.ai/">Grok</a>
    </td>
  </tr>
</table>

### Compatible with any model provider in OpenAI/Gemini/Anthropic API format

## Other Features

- Support for local model management with Ollama
- Support for local file processing
- Artifacts support
- Customizable search engines (parsed through models, no API adaptation required)
- MCP support (built-in npx, no additional node environment installation needed)
- Support for multimodality models
- Local chat data backup and recovery
- Compatibility with any model provider in OpenAI, Gemini, and Anthropic API formats

## Development

Please read the [Contribution Guidelines](./CONTRIBUTING.md)
Windows and Linux are packaged by GitHub Action.
For Mac-related signing and packaging, please refer to the [Mac Release Guide](https://github.com/ThinkInAIXYZ/deepchat/wiki/Mac-Release-Guide).

### Install dependencies

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

### Start development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux

# Specify architecture packaging
$ npm run build:win:x64
$ npm run build:win:arm64
$ npm run build:mac:x64
$ npm run build:mac:arm64
$ npm run build:linux:x64
$ npm run build:linux:arm64
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ThinkInAIXYZ/deepchat&type=Timeline)](https://www.star-history.com/#ThinkInAIXYZ/deepchat&Timeline)


## Contributors

Thank you for considering contributing to deepchat! The contribution guide can be found in the [Contribution Guidelines](./CONTRIBUTING.md).

<a href="https://github.com/ThinkInAIXYZ/deepchat/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ThinkInAIXYZ/deepchat" />
</a>

# 📃 License

[LICENSE](./LICENSE)
