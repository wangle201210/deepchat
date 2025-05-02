<p align='center'>
<img src='./build/icon.png' width="150" height="150" alt="DeepChat AI アシスタントアイコン" />
</p>

<h1 align="center">DeepChat - パワフルなオープンソースマルチモデルAIチャットプラットフォーム</h1>

<p align="center">DeepChatは、強力な検索機能とツール呼び出し機能を備えた、複数のクラウドおよびローカルの大規模言語モデルをサポートする機能豊富なオープンソースAIチャットプラットフォームです。</p>

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

## 📑 目次

- [プロジェクト紹介](#-プロジェクト紹介)
- [なぜDeepChatを選ぶのか](#-なぜdeepchatを選ぶのか)
- [機能のショーケース](#-機能のショーケース)
- [主な機能](#-主な機能)
- [サポートされているモデルプロバイダー](#-サポートされているモデルプロバイダー)
- [ユースケース](#-ユースケース)
- [クイックスタート](#-クイックスタート)
- [開発ガイド](#-開発ガイド)
- [コミュニティと貢献](#-コミュニティと貢献)
- [ライセンス](#-ライセンス)

## 🚀 プロジェクト紹介

DeepChatは、様々な大規模言語モデルと対話するための統一されたインターフェースを提供する強力なオープンソースAIチャットプラットフォームです。OpenAI、Gemini、AnthropicなどのクラウドAPIや、ローカルにデプロイされたOllamaモデルを使用する場合でも、DeepChatはスムーズなユーザー体験を提供します。

クロスプラットフォームAIアシスタントアプリケーションとして、DeepChatは基本的なチャット機能をサポートするだけでなく、検索拡張、ツール呼び出し、マルチモーダル対話などの高度な機能も提供し、AI機能をより身近で効率的なものにします。

## 💡 なぜDeepChatを選ぶのか

他のAIチャットツールと比較して、DeepChatは以下のようなユニークな利点を提供します：

- **統一されたマルチモデル管理**: 1つのアプリケーションでほぼすべての主要なLLMをサポートし、複数のアプリを切り替える必要がありません
- **シームレスなローカルモデル統合**: 組み込みのOllamaサポートにより、コマンドライン操作なしでローカルモデルを管理・使用できます
- **強力な検索拡張**: 複数の検索エンジンをサポートし、AIの応答をより正確でタイムリーにします
- **高度なツール呼び出し**: 組み込みのMCPサポートにより、追加設定なしでコード実行、ウェブアクセス、その他のツールを利用可能です
- **プライバシー重視**: ローカルデータストレージとネットワークプロキシのサポートにより、情報漏洩のリスクを軽減します
- **ビジネスフレンドリー**: Apache License 2.0の下でオープンソース化され、商用・個人利用の両方に適しています

## 📸 機能のショーケース

### 推論能力

<p align='center'>
<img src='./build/screen.jpg' alt="DeepChat AIチャットインターフェースと推論機能のショーケース"/>
</p>

### 検索拡張

<p align='center'>
<img src='./build/screen.search.jpg' alt="DeepChat検索拡張機能のショーケース"/>
</p>

### LaTeXサポート

<p align='center'>
<img src='./build/screen.latex.jpg' alt="DeepChat LaTeX数式レンダリング機能のショーケース"/>
</p>

### アーティファクトサポート

<p align='center'>
<img src='./build/screen.artifacts.jpg' alt="DeepChatアーティファクトマルチメディアレンダリング機能のショーケース"/>
</p>

## 🔥 主な機能

- 🌐 **複数のクラウドLLMプロバイダーサポート**: DeepSeek、OpenAI、Silicon Flow、Grok、Gemini、Anthropicなど
- 🏠 **ローカルモデルデプロイメントサポート**:
  - 包括的な管理機能を備えた統合Ollama
  - コマンドライン操作なしでOllamaモデルのダウンロード、デプロイメント、実行を制御・管理
- 🚀 **豊富で使いやすいチャット機能**
  - コードブロックの優れた表示を含む完全なMarkdownレンダリング
  - 複数セッションの同時会話をネイティブにサポート。モデル生成の完了を待たずに新しいセッションを開始可能
  - MCP統合後、トークン消費を大幅に節約する多様な結果表示のためのアーティファクトレンダリングをサポート
  - メッセージは複数のバリエーションを生成するためのリトライをサポート。会話は自由にフォーク可能で、常に適切な思考の流れを確保
  - 画像、Mermaidダイアグラム、その他のマルチモーダルコンテンツのレンダリングをサポート。Geminiのテキストから画像生成機能を含む
  - 検索結果などの外部情報ソースをコンテンツ内でハイライト表示
- 🔍 **強力な検索拡張機能**
  - MCPモードでBrave Searchなどの主要な検索APIを組み込み、モデルが検索のタイミングを賢く判断
  - ユーザーのウェブブラウジングをシミュレートすることで、Google、Bing、Baidu、Sogou公式アカウント検索などの主要検索エンジンをサポート
  - あらゆる検索エンジンの読み取りをサポート。検索アシスタントモデルを設定するだけで、内部ネットワーク、APIなしのエンジン、垂直ドメイン検索エンジンなど、様々な情報ソースをモデルに接続可能
- 🔧 **優れたMCP（Model Controller Platform）サポート**
  - 非常にユーザーフレンドリーな設定インターフェース
  - 美しく明確なツール呼び出し表示
  - ツールパラメータとリターンデータの自動フォーマット機能を備えた詳細なツール呼び出しデバッグウィンドウ
  - 組み込みNode.js実行環境。npx類似のサービスは追加設定不要
  - StreamableHTTP/SSE/Stdioプロトコルをサポート
  - コード実行、ウェブ情報取得、ファイル操作などの組み込みユーティリティを備えたinMemoryサービスをサポート。二次インストールなしで一般的なユースケースに対応
  - 組み込みMCPサービスを通じて、視覚モデル機能を任意のモデルで使用可能な普遍的な機能に変換
- 💻 **マルチプラットフォームサポート**: Windows、macOS、Linux
- 🎨 **美しく使いやすいインターフェース**、ユーザー志向の設計、丁寧なライト/ダークモードテーマ
- 🔗 **豊富なDeepLinkサポート**: リンクを通じて会話を開始し、他のアプリケーションとシームレスに統合。MCPサービスのワンクリックインストールもサポートし、シンプルさとスピードを実現
- 🚑 **セキュリティ重視の設計**: チャットデータと設定データに暗号化インターフェースとコード難読化機能を備える
- 🛡️ **プライバシー保護**: スクリーン投影の非表示、ネットワークプロキシなどのプライバシー保護方法をサポートし、情報漏洩のリスクを軽減
- 💰 **ビジネスフレンドリー**、オープンソースを採用し、Apache License 2.0プロトコルに基づく

## 🤖 サポートされているモデルプロバイダー

<table>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/ollama.svg" width="50" height="50" alt="Ollama Icon"><br/>
      <a href="https://ollama.com">Ollama</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/deepseek-color.svg" width="50" height="50" alt="Deepseek Icon"><br/>
      <a href="https://deepseek.com/">Deepseek</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/siliconcloud.svg" width="50" height="50" alt="Silicon Icon"><br/>
      <a href="https://www.siliconflow.cn/">Silicon</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/qwen-color.svg" width="50" height="50" alt="QwenLM Icon"><br/>
      <a href="https://chat.qwenlm.ai">QwenLM</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/doubao-color.svg" width="50" height="50" alt="Doubao Icon"><br/>
      <a href="https://console.volcengine.com/ark/">Doubao</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/minimax-color.svg" width="50" height="50" alt="MiniMax Icon"><br/>
      <a href="https://platform.minimaxi.com/">MiniMax</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/fireworks-color.svg" width="50" height="50" alt="Fireworks Icon"><br/>
      <a href="https://fireworks.ai/">Fireworks</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/ppio-color.svg" width="50" height="50" alt="PPIO Icon"><br/>
      <a href="https://ppinfra.com/">PPIO</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/openai.svg" width="50" height="50" alt="OpenAI Icon"><br/>
      <a href="https://openai.com/">OpenAI</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/gemini-color.svg" width="50" height="50" alt="Gemini Icon"><br/>
      <a href="https://gemini.google.com/">Gemini</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/github.svg" width="50" height="50" alt="GitHub Models Icon"><br/>
      <a href="https://github.com/marketplace/models">GitHub Models</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/moonshot.svg" width="50" height="50" alt="Moonshot Icon"><br/>
      <a href="https://moonshot.ai/">Moonshot</a>
    </td>
  </tr>
  <tr align="center">
    <td>
      <img src="./src/renderer/src/assets/llm-icons/openrouter.svg" width="50" height="50" alt="OpenRouter Icon"><br/>
      <a href="https://openrouter.ai/">OpenRouter</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/azure-color.svg" width="50" height="50" alt="Azure OpenAI Icon"><br/>
      <a href="https://azure.microsoft.com/en-us/products/ai-services/openai-service">Azure OpenAI</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/qiniu.svg" width="50" height="50" alt="Qiniu Icon"><br/>
      <a href="https://www.qiniu.com/products/ai-token-api">Qiniu</a>
    </td>
    <td>
      <img src="./src/renderer/src/assets/llm-icons/grok.svg" width="50" height="50" alt="Grok Icon"><br/>
      <a href="https://x.ai/">Grok</a>
    </td>
  </tr>
</table>

### OpenAI/Gemini/Anthropic API形式の任意のモデルプロバイダーと互換性あり

## 🔍 ユースケース

DeepChatは様々なAIアプリケーションシナリオに適しています：

- **日常のアシスタント**: 質問への回答、提案の提供、文章作成の支援
- **開発支援**: コード生成、デバッグ、技術的問題の解決
- **学習ツール**: 概念の説明、知識の探求、学習ガイダンス
- **コンテンツ作成**: コピーライティング、クリエイティブなインスピレーション、コンテンツの最適化
- **データ分析**: データの解釈、チャート生成、レポート作成

## 📦 クイックスタート

### ダウンロードとインストール

[GitHub Releases](https://github.com/ThinkInAIXYZ/deepchat/releases)ページからお使いのシステム用の最新バージョンをダウンロードしてください：

- Windows: `.exe`インストールファイル
- macOS: `.dmg`インストールファイル
- Linux: `.AppImage`または`.deb`インストールファイル

### モデルの設定

1. DeepChatアプリケーションを起動
2. 設定アイコンをクリック
3. "モデルプロバイダー"タブを選択
4. APIキーを追加するか、ローカルOllamaを設定

### 会話を開始

1. "+"ボタンをクリックして新しい会話を作成
2. 使用したいモデルを選択
3. AIアシスタントとの対話を開始

## 💻 開発ガイド

[貢献ガイドライン](./CONTRIBUTING.md)をお読みください。

WindowsとLinuxはGitHub Actionによってパッケージングされます。
Mac関連の署名とパッケージングについては、[Mac リリースガイド](https://github.com/ThinkInAIXYZ/deepchat/wiki/Mac-Release-Guide)を参照してください。

### 依存関係のインストール

```bash
$ npm install
$ npm run installRuntime
# エラーが出た場合: No module named 'distutils'
$ pip install setuptools
# Windows x64の場合
$ npm install --cpu=x64 --os=win32 sharp
# Mac Apple Siliconの場合
$ npm install --cpu=arm64 --os=darwin sharp
# Mac Intelの場合
$ npm install --cpu=x64 --os=darwin sharp
# Linux x64の場合
$ npm install --cpu=x64 --os=linux sharp
```

### 開発を開始

```bash
$ npm run dev
```

### ビルド

```bash
# Windowsの場合
$ npm run build:win

# macOSの場合
$ npm run build:mac

# Linuxの場合
$ npm run build:linux

# アーキテクチャを指定してパッケージング
$ npm run build:win:x64
$ npm run build:win:arm64
$ npm run build:mac:x64
$ npm run build:mac:arm64
$ npm run build:linux:x64
$ npm run build:linux:arm64
```

## 👥 コミュニティと貢献

DeepChatはアクティブなオープンソースコミュニティプロジェクトであり、様々な形での貢献を歓迎します：

- 🐛 [問題を報告する](https://github.com/ThinkInAIXYZ/deepchat/issues)
- 💡 [機能の提案を提出する](https://github.com/ThinkInAIXYZ/deepchat/issues)
- 🔧 [コードの改善を提出する](https://github.com/ThinkInAIXYZ/deepchat/pulls)
- 📚 [ドキュメントを改善する](https://github.com/ThinkInAIXYZ/deepchat/wiki)
- 🌍 [翻訳を手伝う](https://github.com/ThinkInAIXYZ/deepchat/tree/main/locales)

プロジェクトへの参加方法について詳しく知るには、[貢献ガイドライン](./CONTRIBUTING.md)をご確認ください。

## ⭐ スター履歴

[![Star History Chart](https://api.star-history.com/svg?repos=ThinkInAIXYZ/deepchat&type=Timeline)](https://www.star-history.com/#ThinkInAIXYZ/deepchat&Timeline)

## 👨‍💻 貢献者

deepchatへの貢献をご検討いただきありがとうございます！貢献ガイドは[貢献ガイドライン](./CONTRIBUTING.md)でご確認いただけます。

<a href="https://github.com/ThinkInAIXYZ/deepchat/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=ThinkInAIXYZ/deepchat" alt="DeepChatプロジェクト貢献者" />
</a>

## 📃 ライセンス

[LICENSE](./LICENSE)
