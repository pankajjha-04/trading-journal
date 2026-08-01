import 'server-only';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type AttachmentType = 'image/png' | 'image/jpeg' | 'image/webp' | 'application/pdf';

export interface AiRequest {
  system: string;
  messages: AiMessage[];
  maxTokens?: number;
  /** Ask the model to answer in JSON. Off for free-form prose. */
  json?: boolean;
  /** Base64 chart screenshot or statement. Ignored by text-only providers. */
  attachment?: { mediaType: AttachmentType; data: string };
}

export interface AiResponse {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface AiProvider {
  readonly id: string;
  readonly model: string;
  /** Whether images and PDFs can be sent. Text-only providers silently drop them. */
  readonly supportsVision: boolean;
  complete(request: AiRequest): Promise<AiResponse>;
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly kind: 'config' | 'rate_limit' | 'network' | 'refused' | 'unknown',
  ) {
    super(message);
    this.name = 'AiError';
  }
}

/** Free tiers stall under load; a hung request must not hold a server action open. */
const TIMEOUT_MS = 45_000;

async function post(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError') {
      throw new AiError('The model took too long to answer.', 'network');
    }
    throw new AiError('Could not reach the model provider.', 'network');
  } finally {
    clearTimeout(timer);
  }
}

function classify(status: number): AiError['kind'] {
  if (status === 429) return 'rate_limit';
  if (status === 401 || status === 403 || status === 404) return 'config';
  return 'unknown';
}

/**
 * Providers put the actual reason in the body — a wrong model name, a key
 * from the wrong project, a disabled API. Swallowing it leaves nothing to
 * debug, so it goes to the server log while the user still sees a plain
 * message.
 */
async function fail(provider: string, response: Response): Promise<never> {
  let detail = '';
  try {
    detail = (await response.text()).slice(0, 400);
  } catch {
    detail = '(body unavailable)';
  }
  console.error(`[ai:${provider}] ${response.status} ${response.statusText} — ${detail}`);
  throw new AiError(`${provider} returned ${response.status}`, classify(response.status));
}

// ---------------------------------------------------------------- Gemini

class GeminiProvider implements AiProvider {
  readonly id = 'gemini';
  readonly supportsVision = true;

  constructor(
    private readonly apiKey: string,
    // An alias, not a version. Google retires pinned model names every few
    // months — `gemini-2.5-flash` stopped accepting new users and produced a
    // 404 that looked like a broken key. The alias tracks current Flash.
    readonly model = 'gemini-flash-latest',
  ) {}

  async complete(request: AiRequest): Promise<AiResponse> {
    const parts: Record<string, unknown>[] = [];
    if (request.attachment) {
      parts.push({
        inline_data: {
          mime_type: request.attachment.mediaType,
          data: request.attachment.data,
        },
      });
    }
    for (const message of request.messages) parts.push({ text: message.content });

    const response = await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: request.system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            // Flash models reason before answering and those thinking tokens
            // come out of this same budget, which truncated the JSON mid-key
            // at 900. Turning thinking off is not portable — Gemini 3 rejects
            // a zero budget outright — so the budget is simply large enough
            // for both. Unused tokens are not billed.
            maxOutputTokens: request.maxTokens ?? 4096,
            temperature: 0.2,
            ...(request.json === false ? {} : { responseMimeType: 'application/json' }),
          },
        }),
      },
    );

    if (!response.ok) await fail('gemini', response);

    const body = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };

    const candidate = body.candidates?.[0];
    if (candidate?.finishReason === 'SAFETY') {
      throw new AiError('The model declined to answer that.', 'refused');
    }
    // Worth its own error: a truncated answer looks identical to a malformed
    // one, and the fix is completely different.
    if (candidate?.finishReason === 'MAX_TOKENS') {
      console.error('[ai:gemini] hit the output limit before finishing');
      throw new AiError('The answer was cut off before it finished.', 'unknown');
    }

    return {
      text: candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '',
      inputTokens: body.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? 0,
      model: this.model,
    };
  }
}

// ------------------------------------------------------------- Anthropic

class AnthropicProvider implements AiProvider {
  readonly id = 'anthropic';
  readonly supportsVision = true;

  constructor(
    private readonly apiKey: string,
    readonly model = 'claude-sonnet-4-6',
  ) {}

  async complete(request: AiRequest): Promise<AiResponse> {
    const content: Record<string, unknown>[] = [];
    if (request.attachment) {
      const isPdf = request.attachment.mediaType === 'application/pdf';
      content.push({
        type: isPdf ? 'document' : 'image',
        source: {
          type: 'base64',
          media_type: request.attachment.mediaType,
          data: request.attachment.data,
        },
      });
    }
    for (const message of request.messages) {
      content.push({ type: 'text', text: message.content });
    }

    const response = await post('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 1200,
        temperature: 0.2,
        system: request.system,
        messages: [{ role: 'user', content }],
      }),
    });

    if (!response.ok) await fail('anthropic', response);

    const body = (await response.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    return {
      text: (body.content ?? [])
        .filter((block) => block.type === 'text')
        .map((block) => block.text ?? '')
        .join(''),
      inputTokens: body.usage?.input_tokens ?? 0,
      outputTokens: body.usage?.output_tokens ?? 0,
      model: this.model,
    };
  }
}

// -------------------------------------------- OpenAI-compatible (Groq etc)

class OpenAiCompatibleProvider implements AiProvider {
  readonly supportsVision = false;

  constructor(
    readonly id: string,
    private readonly apiKey: string,
    private readonly baseUrl: string,
    readonly model: string,
  ) {}

  async complete(request: AiRequest): Promise<AiResponse> {
    const response = await post(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: request.maxTokens ?? 1200,
        temperature: 0.2,
        ...(request.json === false ? {} : { response_format: { type: 'json_object' } }),
        messages: [
          { role: 'system', content: request.system },
          ...request.messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!response.ok) await fail(this.id, response);

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    return {
      text: body.choices?.[0]?.message?.content ?? '',
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
      model: this.model,
    };
  }
}

/**
 * One switch, set in the environment. Free tiers change their limits without
 * warning, so moving provider must never mean touching feature code.
 */
export function getProvider(): AiProvider {
  const choice = (process.env.AI_PROVIDER ?? 'gemini').toLowerCase();

  switch (choice) {
    case 'anthropic': {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new AiError('ANTHROPIC_API_KEY is not set.', 'config');
      return new AnthropicProvider(key, process.env.AI_MODEL || undefined);
    }
    case 'groq': {
      const key = process.env.GROQ_API_KEY;
      if (!key) throw new AiError('GROQ_API_KEY is not set.', 'config');
      return new OpenAiCompatibleProvider(
        'groq',
        key,
        'https://api.groq.com/openai/v1',
        process.env.AI_MODEL || 'llama-3.3-70b-versatile',
      );
    }
    case 'openrouter': {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) throw new AiError('OPENROUTER_API_KEY is not set.', 'config');
      return new OpenAiCompatibleProvider(
        'openrouter',
        key,
        'https://openrouter.ai/api/v1',
        process.env.AI_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
      );
    }
    case 'gemini':
    default: {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new AiError('GEMINI_API_KEY is not set.', 'config');
      return new GeminiProvider(key, process.env.AI_MODEL || undefined);
    }
  }
}
