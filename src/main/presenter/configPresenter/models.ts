export const defaultModelsSettings = [
  // Grok,
  {
    id: 'grok-3-mini-fast-beta',
    name: 'Grok 3 Mini Fast Beta',
    temperature: 1,
    contextLength: 120000,
    maxTokens: 100_000,
    match: ['grok-3-mini-fast', 'grok-3-mini-fast-latest', 'grok-3-mini-fast-beta'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'grok-3-mini-beta',
    name: 'Grok 3 Mini Beta',
    temperature: 1,
    contextLength: 120000,
    maxTokens: 100_000,
    match: ['grok-3-mini', 'grok-3-mini-latest', 'grok-3-mini-beta'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'grok-3-fast-beta',
    name: 'Grok 3 Fast Beta',
    temperature: 0.7,
    contextLength: 120000,
    maxTokens: 100_000,
    match: ['grok-3-fast', 'grok-3-fast-latest', 'grok-3-fast-beta'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'grok-2-vision-1212',
    name: 'Grok 2 Vision 1212',
    temperature: 0.7,
    contextLength: 32000,
    maxTokens: 32000,
    match: ['grok-2-vision', 'grok-2-vision-latest', 'grok-2-vision-1212'],
    vision: true,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'grok-2-image-1212',
    name: 'Grok 2 Image 1212',
    temperature: 0.7,
    contextLength: 130_000,
    maxTokens: 100_000,
    match: ['grok-2-image', 'grok-2-image-latest', 'grok-2-image-1212'],
    vision: true,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'grok-3-beta',
    name: 'Grok 3 Beta',
    temperature: 0.7,
    contextLength: 120000,
    maxTokens: 100_000,
    match: ['grok-3', 'grok-3-latest', 'grok-3-beta'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'grok-2-1212',
    name: 'Grok 2 1212',
    contextLength: 120000,
    temperature: 0.7,
    maxTokens: 100_000,
    match: ['grok-2', 'grok-2-latest', 'grok-2-1212'],
    vision: false,
    functionCall: true,
    reasoning: false
  },

  // Gemini 系列模型
  {
    id: 'gemini-2.5-pro-exp-03-25',
    name: 'Gemini 2.5 Pro Exp 03-05',
    temperature: 0.7,
    maxTokens: 65536,
    contextLength: 2048576,
    match: ['gemini-2.5-pro-exp-03-25'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gemini-2.0-flash-exp-image-generation',
    name: 'Gemini 2.0 Flash Exp Image Generation',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 1048576,
    match: ['gemini-2.0-flash-exp-image-generation'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gemini-2.0-pro-exp-02-05',
    name: 'Gemini 2.0 Pro Exp 02-05',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 2048576,
    match: ['gemini-2.0-pro-exp-02-05'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 1048576,
    match: ['gemini-2.0-flash'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gemini-1.5-flash',
    name: 'Gemini 1.5 Flash',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 1048576,
    match: ['gemini-1.5-flash'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 2097152,
    match: ['gemini-1.5-pro'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  // DeepSeek系列模型配置
  {
    id: 'deepseek-vl2',
    name: 'DeepSeek VL2',
    temperature: 0.7,
    maxTokens: 4000,
    contextLength: 4096,
    match: ['deepseek-vl2'],
    vision: true,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'deepseek-r1-distill-qwen-32b',
    name: 'DeepSeek R1 Distill Qwen 32B',
    temperature: 0.7,
    maxTokens: 4000,
    contextLength: 32768,
    match: ['deepseek-r1-distill-qwen-32b'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'deepseek-r1-distill-qwen-14b',
    name: 'DeepSeek R1 Distill Qwen 14B',
    temperature: 0.7,
    maxTokens: 4000,
    contextLength: 32768,
    match: ['deepseek-r1-distill-qwen-14b'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'deepseek-r1-distill-qwen-7b',
    name: 'DeepSeek R1 Distill Qwen 7B',
    temperature: 0.7,
    maxTokens: 4000,
    contextLength: 32768,
    match: ['deepseek-r1-distill-qwen-7b'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'deepseek-r1-distill-qwen-1.5b',
    name: 'DeepSeek R1 Distill Qwen 1.5B',
    temperature: 0.6,
    maxTokens: 4000,
    contextLength: 65536,
    match: ['deepseek-r1-distill-qwen-1.5b', 'deepseek-r1-distill-qwen-1-5b'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'deepseek-r1-distill-llama-8b',
    name: 'DeepSeek R1 Distill Llama 8B',
    temperature: 0.6,
    maxTokens: 4000,
    contextLength: 65536,
    match: ['deepseek-r1-distill-llama-8b'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'deepseek-r1-distill-llama-70b',
    name: 'DeepSeek R1 Distill Llama 70B',
    temperature: 0.6,
    maxTokens: 4000,
    contextLength: 65536,
    match: ['deepseek-r1-distill-llama-70b'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    temperature: 0.6,
    maxTokens: 4000,
    contextLength: 65536,
    match: ['deepseek-r1', 'deepseek-r1-zero'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    temperature: 0.6,
    maxTokens: 8192,
    contextLength: 65536,
    match: ['deepseek-reasoner'],
    vision: false,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'deepseek-chat-v3-0324',
    name: 'DeepSeek Chat v3 0324',
    temperature: 0.6,
    maxTokens: 8192,
    contextLength: 65536,
    match: ['deepseek-chat-v3-0324'],
    vision: false,
    functionCall: true,
    reasoning: true
  },
  {
    id: 'deepseek-v3-0324',
    name: 'DeepSeek v3 0324',
    temperature: 0.6,
    maxTokens: 8192,
    contextLength: 65536,
    match: ['deepseek-v3-0324'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'deepseek-chat',
    name: 'DeepSeek chat',
    temperature: 1,
    maxTokens: 8192,
    contextLength: 65536,
    match: ['deepseek-chat'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    temperature: 0.6,
    maxTokens: 4000,
    contextLength: 65536,
    match: ['deepseek-v3'],
    vision: false,
    // https://github.com/deepseek-ai/DeepSeek-V3/issues/15 use mock function call
    functionCall: false,
    reasoning: false
  },
  {
    id: 'deepseek-v2.5',
    name: 'DeepSeek V2.5',
    temperature: 0.6,
    maxTokens: 4000,
    contextLength: 32768,
    match: ['deepseek-v2.5', 'deepseek-v2-5'],
    vision: false,
    functionCall: true,
    reasoning: false
  },

  // Claude系列模型配置
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet',
    temperature: 1,
    maxTokens: 64000,
    contextLength: 204800,
    match: ['claude-3-7-sonnet', 'claude-3.7-sonnet'],
    vision: true,
    functionCall: true,
    reasoning: true
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 204800,
    match: ['claude-3-5-sonnet', 'claude-3.5-sonnet'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'claude-3-opus',
    name: 'Claude 3 Opus',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 204800,
    match: ['claude-3-opus', 'claude-3.opus'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 204800,
    match: ['claude-3-haiku', 'claude-3.haiku', 'claude-3-5-haiku', 'claude-3.5-haiku'],
    vision: true,
    functionCall: true,
    reasoning: false
  },

  // OpenAI GPT系列模型配置
  {
    id: 'gpt-4.1-nano',
    name: 'GPT-4.1-Nano',
    temperature: 0.7,
    maxTokens: 32_000,
    contextLength: 1_000_000,
    match: ['gpt-4.1-nano'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1-Mini',
    temperature: 0.7,
    maxTokens: 32_000,
    contextLength: 1_000_000,
    match: ['gpt-4.1-mini'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    temperature: 0.7,
    maxTokens: 32_000,
    contextLength: 1_000_000,
    match: ['gpt-4.1'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 128000,
    match: ['gpt-4o'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 128000,
    match: ['gpt-4-turbo', 'gpt-4-1106'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gpt-4-32k',
    name: 'GPT-4 32K',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['gpt-4-32k'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 8192,
    match: ['gpt-4-0'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'gpt-3.5-turbo-16k',
    name: 'GPT-3.5 Turbo 16K',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 16384,
    match: ['gpt-3.5-turbo-16k', 'gpt-3-5-turbo-16k'],
    vision: false,
    functionCall: true
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 4096,
    match: ['gpt-3.5-turbo', 'gpt-3-5-turbo'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'o1-preview',
    name: 'OpenAI o1 Preview',
    temperature: 0.7,
    maxTokens: 32768,
    contextLength: 128000,
    match: ['o1-preview'],
    vision: true,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'o1-mini',
    name: 'OpenAI o1 Mini',
    temperature: 0.7,
    maxTokens: 65536,
    contextLength: 128000,
    match: ['o1-mini'],
    vision: true,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'o1-mini',
    name: 'OpenAI o1 Mini',
    temperature: 0.7,
    maxTokens: 65536,
    contextLength: 128000,
    match: ['o1-mini'],
    vision: true,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'o1',
    name: 'OpenAI o1',
    temperature: 0.7,
    maxTokens: 32768,
    contextLength: 128000,
    match: ['o1'],
    vision: true,
    functionCall: false,
    reasoning: true
  },
  {
    id: 'gpt-4.5-preview',
    name: 'GPT-4.5 Preview',
    temperature: 0.7,
    maxTokens: 16_384,
    contextLength: 128000,
    match: ['gpt-4.5-preview'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  // Llama系列
  {
    id: 'llama-4-maverick',
    name: 'Llama 4 Maverick',
    temperature: 1,
    maxTokens: 200_000,
    contextLength: 200_000,
    match: ['llama-4-maverick'],
    vision: true,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'llama-4-scout',
    name: 'Llama 4 Scout',
    temperature: 1,
    maxTokens: 480_000,
    contextLength: 480_000,
    match: ['llama-4-scout'],
    vision: true,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'llama-3.1-405b',
    name: 'Llama 3.1 405B',
    temperature: 0.7,
    maxTokens: 32768,
    contextLength: 128000,
    match: ['llama-3.1-405b', 'llama-3.1-405-b', 'llama-3.1-405'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'llama-3.1-70b',
    name: 'Llama 3.1 70B',
    temperature: 0.7,
    maxTokens: 16384,
    contextLength: 128000,
    match: ['llama-3.1-70b', 'llama-3.1-70-b', 'llama-3.1-70'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'llama-3-70b',
    name: 'Llama 3 70B',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 32768,
    match: ['llama-3-70b', 'llama-3-70-b', 'llama-3-70'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'llama-3.1-8b',
    name: 'Llama 3.1 8B',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 8192,
    match: ['llama-3.1-8b', 'llama-3.1-8-b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'llama-3-8b',
    name: 'Llama 3 8B',
    temperature: 0.7,
    maxTokens: 2048,
    contextLength: 8192,
    match: ['llama-3-8b', 'llama-3-8-b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'llama-2-70b',
    name: 'Llama 2 70B',
    temperature: 0.7,
    maxTokens: 2048,
    contextLength: 4096,
    match: ['llama-2-70b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'llama-2',
    name: 'Llama 2',
    temperature: 0.7,
    maxTokens: 2048,
    contextLength: 4096,
    match: ['llama-2-'],
    vision: false,
    functionCall: false,
    reasoning: false
  },

  // Mistral系列
  {
    id: 'mistral-large-2',
    name: 'Mistral Large 2',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 32768,
    match: ['mistral-large-2'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'mistral-large',
    name: 'Mistral Large',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 32768,
    match: ['mistral-large'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'mistral-8x7b',
    name: 'Mistral 8x7B',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 32768,
    match: ['mistral-8x7b', 'mixtral-8x7b'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 8192,
    match: ['mistral-7b'],
    vision: false,
    functionCall: true,
    reasoning: false
  },

  // Qwen系列
  {
    id: 'qwq-32b',
    name: 'Qwen 32B',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['qwq-32b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'QVQ-72B-Preview',
    name: 'QVQ-72B-Preview',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['QVQ-72B-Preview'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'Qwen2-VL-72B-Instruct',
    name: 'Qwen2-VL-72B-Instruct',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['Qwen2-VL-72B-Instruct'],
    vision: true,
    functionCall: false,
    reasoning: false
  },

  {
    id: 'qwen2.5-72b',
    name: 'Qwen 2.5 72B',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 131072,
    match: ['qwen2.5-72b', 'qwen-2.5-72b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'qwen2.5-32b',
    name: 'Qwen 2.5 32B',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 131072,
    match: ['qwen2.5-32b', 'qwen-2.5-32b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'qwen2.5-14b',
    name: 'Qwen 2.5 14B',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 131072,
    match: ['qwen2.5-14b', 'qwen-2.5-14b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'qwen2.5-7b',
    name: 'Qwen 2.5 7B',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 131072,
    match: ['qwen2.5-7b', 'qwen-2.5-7b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'qwen2.5',
    name: 'Qwen 2.5',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 128000,
    match: ['qwen2.5-', 'qwen-2.5-'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'qwen',
    name: 'Qwen',
    temperature: 0.7,
    maxTokens: 2048,
    contextLength: 32768,
    match: ['qwen-'],
    vision: false,
    functionCall: false,
    reasoning: false
  },

  // Yi系列
  {
    id: 'yi-34b',
    name: 'Yi 34B',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['yi-34b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'yi',
    name: 'Yi',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 16384,
    match: ['yi-'],
    vision: false,
    functionCall: false,
    reasoning: false
  },

  // Gemma系列
  {
    id: 'gemma-3',
    name: 'Gemma 3',
    temperature: 0.7,
    maxTokens: 40000,
    contextLength: 120_000,
    match: ['gemma-3', 'gemma3'],
    vision: true,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'gemma-2-27b',
    name: 'Gemma 2 27B',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 8192,
    match: ['gemma-2-27b', 'gemma2'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'gemma-2-9b',
    name: 'Gemma 2 9B',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 8192,
    match: ['gemma-2-9b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'gemma-2-2b',
    name: 'Gemma 2 2B',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 8192,
    match: ['gemma-2-2b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'gemma-7b',
    name: 'Gemma 7B',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 8192,
    match: ['gemma-7b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'gemma-2b',
    name: 'Gemma 2B',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 8192,
    match: ['gemma-2b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },

  // Phi系列
  {
    id: 'phi-4',
    name: 'Phi-4',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 128000,
    match: ['phi-4-', 'phi4-', 'phi4'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'phi-3',
    name: 'Phi-3',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['phi-3-', 'phi3-', 'phi3'],
    vision: false,
    functionCall: false,
    reasoning: false
  },

  // Doubao (字节跳动)模型配置
  {
    id: 'doubao-1.5-pro-256k',
    name: 'Doubao 1.5 Pro 256K',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 262144,
    match: ['doubao-1.5-pro-256k'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'doubao-1.5-vision-pro-32k',
    name: 'Doubao 1.5 Vision Pro 32K',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['doubao-1.5-vision-pro-32k'],
    vision: true,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'doubao-1.5-pro-32k',
    name: 'Doubao 1.5 Pro 32K',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['doubao-1.5-pro-32k'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'doubao',
    name: 'Doubao',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 16384,
    match: ['doubao'],
    vision: false,
    functionCall: false,
    reasoning: false
  },

  // MiniMax模型配置
  {
    id: 'minimax-01',
    name: 'MiniMax 01',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 1048576,
    match: ['minimax-01', 'minimax/minimax-01', 'minimax-text-01'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'glm-4-plus',
    name: 'GLM-4 Plus',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 1048576,
    match: ['glm-4-plus', 'glm-4-air'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'step-2-16k',
    name: 'Step-2 16K',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 16384,
    match: ['step-2-16k-exp', 'step-2-16k'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'step-2-mini',
    name: 'Step-2 Mini',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['step-2-mini'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['minimax'],
    vision: false,
    functionCall: true,
    reasoning: false
  },

  // Fireworks AI模型配置
  {
    id: 'fireworks-llama-3.1-405b',
    name: 'Fireworks Llama 3.1 405B',
    temperature: 0.7,
    maxTokens: 32768,
    contextLength: 128000,
    match: ['fireworks', 'llama-3.1-405b', 'llama-3.1-405-b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'fireworks-llama-3.1-70b',
    name: 'Fireworks Llama 3.1 70B',
    temperature: 0.7,
    maxTokens: 16384,
    contextLength: 128000,
    match: ['fireworks', 'llama-3.1-70b', 'llama-3.1-70-b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'fireworks-llama-3.1-8b',
    name: 'Fireworks Llama 3.1 8B',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 8192,
    match: ['fireworks', 'llama-3.1-8b', 'llama-3.1-8-b'],
    vision: false,
    functionCall: false,
    reasoning: false
  },
  {
    id: 'fireworks',
    name: 'Fireworks',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 16384,
    match: ['fireworks', 'accounts/fireworks/'],
    vision: false,
    functionCall: false,
    reasoning: false
  },

  // Moonshot (月之暗面)模型配置
  {
    id: 'moonshot-v1-8k',
    name: 'Moonshot V1 8K',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 8192,
    match: ['moonshot-v1-8k', 'moonshot/moonshot-v1-8k'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'moonshot-v1-32k',
    name: 'Moonshot V1 32K',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 32768,
    match: ['moonshot-v1-32k', 'moonshot/moonshot-v1-32k'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'moonshot-v1-128k',
    name: 'Moonshot V1 128K',
    temperature: 0.7,
    maxTokens: 8192,
    contextLength: 131072,
    match: ['moonshot-v1-128k', 'moonshot/moonshot-v1-128k'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'moonshot',
    name: 'Moonshot',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['moonshot'],
    vision: false,
    functionCall: true,
    reasoning: false
  },

  // Azure OpenAI配置
  {
    id: 'azure-openai-gpt-4o',
    name: 'Azure OpenAI GPT-4o',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 128000,
    match: ['azure-openai', 'azure/openai', 'gpt-4o'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'azure-openai-gpt-4-turbo',
    name: 'Azure OpenAI GPT-4 Turbo',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 128000,
    match: ['azure-openai', 'azure/openai', 'gpt-4-turbo', 'gpt-4-1106'],
    vision: true,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'azure-openai-gpt-4-32k',
    name: 'Azure OpenAI GPT-4 32K',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 32768,
    match: ['azure-openai', 'azure/openai', 'gpt-4-32k'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'azure-openai-gpt-4',
    name: 'Azure OpenAI GPT-4',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 8192,
    match: ['azure-openai', 'azure/openai', 'gpt-4'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'azure-openai-gpt-3.5-turbo-16k',
    name: 'Azure OpenAI GPT-3.5 Turbo 16K',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 16384,
    match: ['azure-openai', 'azure/openai', 'gpt-3.5-turbo-16k'],
    vision: false,
    functionCall: true,
    reasoning: false
  },
  {
    id: 'azure-openai-gpt-3.5-turbo',
    name: 'Azure OpenAI GPT-3.5 Turbo',
    temperature: 0.7,
    maxTokens: 4096,
    contextLength: 4096,
    match: ['azure-openai', 'azure/openai', 'gpt-3.5-turbo'],
    vision: false,
    functionCall: true,
    reasoning: false
  }
]
