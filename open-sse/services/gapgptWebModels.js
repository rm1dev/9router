// Service to fetch live model catalog from GapGPT Web (gapgpt.app)
// Extracts chatModelOptions from the latest Vite chat chunk.

export const STATIC_GAPGPT_WEB_MODELS = [
  {
    "id": "A-GAP",
    "name": "GapGPT 6",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI",
    "name": "Gemini",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-CLAUDE",
    "name": "Claude",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GROK",
    "name": "Grok",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-DEEPSEEK",
    "name": "DeepSeek",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GAP-4.1",
    "name": "GapGPT-4.1",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GAMMA",
    "name": "Gamma",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-SONNET-4",
    "name": "Claude 4 Sonnet",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-SONNET-4.6",
    "name": "Claude 4.6 Sonnet",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-SONNET-5",
    "name": "Claude Sonnet 5.5",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-SONNET-4.5",
    "name": "Claude 4.5 Sonnet",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-OPUS-4",
    "name": "Claude 4 Opus",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-OPUS-4.1",
    "name": "Claude 4.1 Opus",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-OPUS-4.5",
    "name": "Claude Opus 5.5",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-FABLE-5",
    "name": "Claude Fable 5.1",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-DEEPSEEK-FLASH",
    "name": "DeepSeek V4.1 Flash",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-DEEPSEEK-PRO",
    "name": "DeepSeek V4 Pro",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-DEEPSEEK-V3",
    "name": "DeepSeek V3",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GAP-DEEPSEEK-V3",
    "name": "DeepSeek V3",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GROK-4.5",
    "name": "Grok 4.7",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GROK-4",
    "name": "Grok 4.3",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GROK-4-FAST",
    "name": "Grok 4.1 Fast",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-GROK-3",
    "name": "Grok 3",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-QWEN-3",
    "name": "Qwen 3.6",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-QWEN-3-MAX",
    "name": "Qwen 3.8 Max",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-KIMI-K2",
    "name": "Kimi 2.5",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-KIMI-K3",
    "name": "Kimi K3",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-MINIMAX-M2",
    "name": "Minimax M2",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GLM-4.6",
    "name": "GLM 5.3",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-PERPLEXITY",
    "name": "Perplexity",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-QWEN-3-CODER",
    "name": "Qwen3 Coder Plus",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-QWQ-32B",
    "name": "QwQ 32B",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-O4-MINI",
    "name": "o4-mini",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-O4-MINI-HIGH",
    "name": "o4-mini-high",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-O3",
    "name": "o3",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-O3-PRO",
    "name": "o3 pro",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-SONNET3.7",
    "name": "Claude 3.7 Sonnet",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-6-ASTRA",
    "name": "GPT-6 Astra",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-GPT-5.5",
    "name": "GPT-6.1 Sol",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-5.6-LUNA",
    "name": "GPT-6 Luna",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-5.6-TERRA",
    "name": "GPT-5.6 Terra",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-5.2",
    "name": "GPT-5.4",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-5.2-PRO",
    "name": "GPT-5.4 Pro",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-5",
    "name": "GPT-5.1",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-5-PRO",
    "name": "GPT-5 Pro",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-5-CODEX",
    "name": "GPT-5.3 Codex",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-5-MINI",
    "name": "GPT-5.4 mini",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-5-NANO",
    "name": "GPT-5.4 nano",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-4.1",
    "name": "GPT-4.1",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-4.1-MINI",
    "name": "GPT-4.1 mini",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-4.1-NANO",
    "name": "GPT-4.1 nano",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-DEEPSEEK-R1",
    "name": "DeepSeek R1",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-GEMINI-2.0-FLASH-THINKING",
    "name": "Gemini Flash 2.0 Thinking",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-SONNET3.7-THINKING",
    "name": "Claude 3.7 Sonnet Thinking",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-HAIKU-4.5",
    "name": "Claude Haiku 5.5",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-HAIKU3.5",
    "name": "Claude 3.5 Haiku",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-FLUX-PRO-KONTEXT",
    "name": "Flux Pro Kontext",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-FLUX-2",
    "name": "Flux 2",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-IMAGEN4",
    "name": "Imagen 4",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-MIDJ",
    "name": "Midjourney",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-IMAGE-2",
    "name": "GPT Image 2",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-IMAGE-2.5",
    "name": "GPT Image 2.5",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-IMAGE-1.5",
    "name": "GPT Image 1.5",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT-IMAGE-1",
    "name": "GPT Image 1",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-2.5-FLASH-IMAGE",
    "name": "Nano Banana 2.1",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-3.1-FLASH-LITE-IMAGE",
    "name": "Nano Banana 2 Lite",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-3-PRO-IMAGE",
    "name": "Nano Banana Pro",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT4O-MINI",
    "name": "GPT-4o Mini",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-DALLE3",
    "name": "DALLE-3",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-2.5-FLASH",
    "name": "Gemini 2.5 Flash",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-2.0-FLASH",
    "name": "Gemini 2.0 flash",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-2.0-FLASH-LITE",
    "name": "Gemini 3.5 Flash Lite",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-2.0-PRO",
    "name": "Gemini 2.0 pro",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-3-PRO",
    "name": "Gemini 4 Argon",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-GEMINI-3-FLASH",
    "name": "Gemini 3.8 Flash",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-GEMINI-3.5-FLASH",
    "name": "Gemini 3.5 Flash",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-GEMINI-2.5-PRO",
    "name": "Gemini 2.5 pro",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GROK-3-THINKING",
    "name": "Grok 3 Thinking",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-OPUS",
    "name": "Claude Opus",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-FREEGPT",
    "name": "GapGPT 6 Lite",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-BGPT",
    "name": "GPT Builder",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-Z-IMAGE-TURBO",
    "name": "Qwen Image 2.1",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-FLUX1-SCHNELL",
    "name": "Flux Schnell",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-SDXL",
    "name": "StableDiffusion XL",
    "kind": "image",
    "supportsReasoning": false
  },
  {
    "id": "A-O1-MINI",
    "name": "o1-mini",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-O1",
    "name": "o1",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-GPT4O",
    "name": "GPT-4o",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-SONNET3.5",
    "name": "Claude 3.5 Sonnet",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-VEO-3-1-LITE",
    "name": "Veo 3.1 Lite",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-VEO-3-1-FAST",
    "name": "Veo 3.1 Fast",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-VEO-3-1-QUALITY",
    "name": "Veo 3.1",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-VEO-3-FAST",
    "name": "Veo 3.1 Fast",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-OMNI",
    "name": "Gemini Omni",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-VEO-3",
    "name": "Veo 3.1",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-HUNYUAN",
    "name": "Hunyuan",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-KLING-V1-6-STD",
    "name": "Kling v1.6 standard",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-KLING-V2-5-TURBO-STD",
    "name": "Kling v2.5 Turbo",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-SEEDANCE-2-5",
    "name": "Seedance 2.5",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-SEEDANCE-2-0",
    "name": "Seedance 2.0",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-KLING-O3-STD",
    "name": "Kling 3 Turbo",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-KLING-O3-PRO",
    "name": "Kling 3 Turbo Pro",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-OMNI-1-1",
    "name": "Gemini Omni 1.1",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-FLUX-3",
    "name": "Flux 3",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-SORA-2",
    "name": "Sora 2",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-KLING-V2-1-STD",
    "name": "Kling v2.1 standard",
    "kind": "video",
    "supportsReasoning": false
  },
  {
    "id": "A-SUNO",
    "name": "Suno Music",
    "kind": "music",
    "supportsReasoning": false
  },
  {
    "id": "A-O3-MINI",
    "name": "o3-mini",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-O3-MINI-HIGH",
    "name": "o3-mini-high",
    "kind": "llm",
    "supportsReasoning": true
  },
  {
    "id": "A-GPT4",
    "name": "GPT-4 Turbo",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GPT3.5",
    "name": "GPT-3.5",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-HAIKU",
    "name": "Claude Haiku",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-SONNET",
    "name": "Claude Sonnet",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "GPT4O",
    "name": "GPT-4o",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "GPT4",
    "name": "GPT-4 Turbo",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "GPT4V",
    "name": "GPT-4 Vision",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "GEMINI",
    "name": "Gemini",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "OPUS",
    "name": "Claude Opus",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "SONNET",
    "name": "Claude Sonnet",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "HAIKU",
    "name": "Claude Haiku",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "GAPGPT",
    "name": "GPT-4 LM",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "GPT3.5",
    "name": "GPT-3.5",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI1.5PRO",
    "name": "Gemini 1.5 pro",
    "kind": "llm",
    "supportsReasoning": false
  },
  {
    "id": "A-GEMINI-1.5-FLASH",
    "name": "Gemini 1.5 flash",
    "kind": "llm",
    "supportsReasoning": false
  }
];

export async function fetchLiveGapGptWebModels() {
  try {
    const html = await fetch("https://gapgpt.app/", {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(10000),
    }).then((r) => r.text());

    const mapMatch = html.match(/<script type="importmap" id="gapgpt-import-map">(.*?)<\/script>/s);
    if (!mapMatch) return STATIC_GAPGPT_WEB_MODELS;

    const map = JSON.parse(mapMatch[1]);
    const chatEntry = Object.entries(map.imports).find(([k]) => k.includes("chat-v98~s4UOl8X7"));
    if (!chatEntry) return STATIC_GAPGPT_WEB_MODELS;

    const chunkJs = await fetch("https://gapgpt.app" + chatEntry[1], {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(15000),
    }).then((r) => r.text());

    const exportMatch = chunkJs.match(/([a-zA-Z0-9_$]+)\s+as\s+chatModelOptions/);
    if (!exportMatch) return STATIC_GAPGPT_WEB_MODELS;
    const varName = exportMatch[1];

    const at = chunkJs.indexOf(varName + "=[new ");
    if (at === -1) return STATIC_GAPGPT_WEB_MODELS;
    const start = chunkJs.indexOf("[", at);

    let depth = 0;
    let end = -1;
    for (let i = start; i < chunkJs.length; i++) {
      if (chunkJs[i] === "[") depth++;
      else if (chunkJs[i] === "]") {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    const arrayStr = chunkJs.slice(start, end + 1);

    const re = /new\s+[a-zA-Z0-9_$]+\((\{[\s\S]*?\})\)/g;
    const models = [];
    let m;
    while ((m = re.exec(arrayStr)) !== null) {
      const objStr = m[1];
      const valMatch = objStr.match(/value:\s*["']([^"']+)["']/);
      const labelMatch = objStr.match(/label:\s*(?:[a-zA-Z0-9_$]+\.[a-zA-Z0-9_$]+|["']([^"']+)["'])/);
      if (valMatch) {
        const val = valMatch[1];
        let lbl = labelMatch ? (labelMatch[1] || val) : val;
        if (val === "A-GAP") lbl = "GapGPT 6";
        if (val === "A-GAP-4.1") lbl = "GapGPT-4.1";
        const isReasoning = objStr.includes("reasoningModel:!0") || objStr.includes("reasoningModel: true");
        const isImage = objStr.includes("imageModel:!0") || objStr.includes("imageModel: true");
        const isVideo = objStr.includes("videoModel:!0") || objStr.includes("videoModel: true");
        const isMusic = objStr.includes("musicModel:!0") || objStr.includes("musicModel: true");

        let kind = "llm";
        if (isImage) kind = "image";
        else if (isVideo) kind = "video";
        else if (isMusic) kind = "music";

        models.push({
          id: val,
          name: lbl,
          kind,
          supportsReasoning: isReasoning,
        });
      }
    }

    return models.length > 0 ? models : STATIC_GAPGPT_WEB_MODELS;
  } catch {
    return STATIC_GAPGPT_WEB_MODELS;
  }
}
