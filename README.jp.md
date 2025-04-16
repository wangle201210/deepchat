<p align='center'>
<img src='./build/icon.png' width="150" height="150" alt="logo" />
</p>

<h1 align="center">DeepChat</h1>

<p align="center">イルカはクジラの良き友、DeepChatはあなたの良きアシスタント</p>

<div align="center">
  <a href="./README.zh.md">中文</a> / <a href="./README.md">English</a> / 日本語
</div>

### ディープシンキング

<p align='center'>
<img src='./build/screen.zh.jpg'/>
</p>

### 検索サポート (純粋なローカルから直接検索エンジンへ)

<p align='center'>
<img src='./build/screen.search.zh.jpg'/>
</p>

### Latex 数式サポート

<p align='center'>
<img src='./build/screen.latex.jpg'/>
</p>

### Artifacts 特性

<p align='center'>
<img src='./build/screen.artifacts.jpg'/>
</p>

## 主な特徴

- 🌐 複数のモデルクラウドサービスをサポート：DeepSeek、OpenAI、Silicon Flow、Grok、Gemini、Anthropic など
- 🏠 ローカルモデルデプロイをサポート：Ollama。完全な管理能力、コマンドを打つことなく Ollama のダウンロード、デプロイ、モデル実行を制御・管理
- 🚀 使いやすく豊富な対話能力
  - 完全な Markdown レンダリング、優れたコードモジュールレンダリング
  - 複数チャネルの会話を同時に行うことを自然にサポート。モデル生成終了を待たずに新しい会話を開始でき、効率Max
  - Artifacts レンダリングをサポートし、豊富で多様な結果表示。MCP 化によりトークン消費を大幅に節約
  - メッセージのリトライによる複数バリアント生成をサポート。会話は自由に分岐可能、あなたに合った思考経路が必ず見つかる
  - 画像、Mermaid テーブルなどのマルチモーダルコンテンツのレンダリングをサポート、Gemini のテキストから画像生成能力をサポート
  - コンテンツ内で検索などの外部情報源をマーキング表示可能
- 🔍 欠点のない検索拡張能力
  - MCP モードを通じて Brave や博査（Brave Search）などの業界で優れた検索 API を内蔵、モデルが自律的にインテリジェント検索を判断
  - ユーザーのウェブ閲覧をシミュレートすることで Google/Bing/Baidu/搜狗公众号検索などの主要な検索エンジンをサポートし、大規模モデルが人間のように検索エンジンを読むことを可能に
  - 任意の検索エンジンの読み取りをサポート。検索アシスタントモデルを設定するだけで、イントラネット、API が不足している、または垂直領域の検索エンジンであっても、あらゆる種類の検索に接続し、モデルの情報源とすることが可能
- 🔧 優れた MCP サポート
  - 非常に使いやすい設定インターフェース
  - 美しくクリアなツール呼び出し表示
  - 詳細なツール呼び出しデバッグウィンドウ、ツールパラメータと戻りデータの自動フォーマット
  - 内蔵 Node 実行環境、npx 類サービス環境設定不要
  - StreamableHTTP/SSE/Stdio をサポート
  - inMemory サービスをサポート。コード実行、ウェブ情報取得、ファイル操作などの実用的なツールを内蔵し、ほとんどの日常的な使用シナリオで二次的なインストールなしにすぐに使用可能
  - 内蔵 MCP サービスを通じて視覚モデルの視覚能力を、任意のモデルで実用可能な汎用能力に変換
- 💻 マルチプラットフォームサポート：Windows、macOS、Linux
- 🎨 美しく使いやすいインターフェース、ユーザー指向のデザイン、精巧に配色された明暗テーマ
- 🔗 豊富な DeepLink。リンク一つで会話を開始でき、他のアプリケーションにシームレスに統合。MCP サービスのワンクリックインストールもサポートし、簡単かつ迅速。
- 🚑 セキュリティ優先の設計。会話データと設定データには暗号化インターフェースとコード難読化能力を予約
- 🛡️ プライバシー保護。画面投影非表示、ネットワークプロキシなどのプライバシー保護方式をサポートし、情報漏洩の可能性を低減
- 💰 ビジネスフレンドリー、オープンソースを歓迎、Apache License 2.0 プロトコルに基づく

## 現在サポートされているモデルプロバイダー

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
      <a href="https://www.siliconflow.cn/">Silicon Flow</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/qwen-color.svg" width="50" height="50"><br/>
      <a href="https://chat.qwenlm.ai">QwenLM</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/doubao-color.svg" width="50" height="50"><br/>
      <a href="https://console.volcengine.com/ark/">Volcengine</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/minimax-color.svg" width="50" height="50"><br/>
      <a href="https://minimaxi.com/">MiniMax</a>
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

### 任意の OpenAI/Gemini/Anthropic API 形式のプロバイダーと互換性あり
## その他の特徴

- Ollama ローカルモデル管理をサポート
- ローカルファイル処理をサポート
- Artifacts サポート
- 任意の検索エンジンをカスタム定義（モデル解析により、API 適応不要）
- MCP サポート（npx 内蔵、追加の node 環境インストール不要）
- マルチモーダルモデルサポート
- ローカルチャットデータのバックアップと復元
- OpenAI、Gemini、Anthropic の3つの形式の任意のモデル提供者をサポート

## 開発

まず [貢献ガイドライン](./CONTRIBUTING.zh.md) をお読みください。(注: 貢献ガイドラインは現在中国語のみです)
Windows と Linux は Github Action によってパッケージ化されます。
Mac 関連の署名とパッケージングについては [Mac パッケージングガイド](https://github.com/ThinkInAIXYZ/deepchat/wiki/Mac-%E6%89%93%E5%8C%85%E6%8C%87%E5%8D%97) を参照してください。

### 依存関係のインストール

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

### 開発の開始

```bash
$ npm run dev
```

### ビルド

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux

# 指定アーキテクチャのパッケージング
$ npm run build:win:x64
$ npm run build:win:arm64
$ npm run build:mac:x64
$ npm run build:mac:arm64
$ npm run build:linux:x64
$ npm run build:linux:arm64
```

## Star

[![Star History Chart](https://api.star-history.com/svg?repos=ThinkInAIXYZ/deepchat&type=Timeline)](https://www.star-history.com/#ThinkInAIXYZ/deepchat&Timeline)

## 貢献者リスト

DeepChat の構築に参加してくださったすべての貢献者に感謝します！参加したい場合は、[貢献ガイドライン](./CONTRIBUTING.md) をお読みください。(注: 貢献ガイドラインは現在英語のみです)

<a href="https://github.com/ThinkInAIXYZ/deepchat/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ThinkInAIXYZ/deepchat" />
</a>

# 📃 ライセンス

[LICENSE](./LICENSE)
