import { NextResponse } from 'next/server';
import { emptyTriage, parseChatbotResult, parseTriage, type Triage } from '../../lib/commercial-triage';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

const responseHeaders = { 'Cache-Control': 'no-store' };

function webhookUrl() {
  const value = process.env.CHATBOT_N8N_WEBHOOK_URL?.trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

const configured = (value: string | undefined) => !!value?.trim() && value.trim() !== 'not_configured';
const available = () =>
  process.env.CHATBOT_AI_ENABLED === 'true' &&
  configured(process.env.GEMINI_API_KEY) &&
  configured(process.env.GEMINI_CHATBOT_MODEL) &&
  !!webhookUrl();

export async function GET() {
  return NextResponse.json({ available: available() }, { headers: responseHeaders });
}

function parseMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 30) throw new Error();
  let total = 0;
  return value.map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error();
    const message = item as Record<string, unknown>;
    if ((message.role !== 'user' && message.role !== 'assistant') || typeof message.content !== 'string') throw new Error();
    const content = message.content.trim();
    total += content.length;
    if (!content || content.length > 1000 || total > 12000) throw new Error();
    return { role: message.role, content };
  });
}

let windowStart = 0;
let requests = 0;

export async function POST(request: Request) {
  if (!available()) {
    return NextResponse.json({ message: 'O assistente está indisponível. Use o formulário direto para continuar.' }, { status: 503, headers: responseHeaders });
  }
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin) {
    return NextResponse.json({ message: 'Origem inválida.' }, { status: 403, headers: responseHeaders });
  }

  let messages: ChatMessage[];
  let triage: Triage = { ...emptyTriage };
  try {
    const body = await request.text();
    if (body.length > 30000) throw new Error();
    const payload = JSON.parse(body) as { messages?: unknown; triage?: unknown; website?: unknown };
    if (payload.website) throw new Error();
    messages = parseMessages(payload.messages);
    if (payload.triage !== undefined) triage = parseTriage(payload.triage);
  } catch {
    return NextResponse.json({ message: 'Conversa inválida ou muito longa.' }, { status: 400, headers: responseHeaders });
  }

  if (Date.now() - windowStart > 60000) { windowStart = Date.now(); requests = 0; }
  if (++requests > 20) {
    return NextResponse.json({ message: 'Muitas mensagens. Aguarde um minuto ou use o formulário direto.' }, { status: 429, headers: { ...responseHeaders, 'Retry-After': '60' } });
  }

  try {
    const provider = await fetch(webhookUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(25000),
      body: JSON.stringify({ messages, triage }),
    });
    if (!provider.ok) {
      console.error('n8n chatbot request failed', provider.status);
      throw new Error('Workflow unavailable');
    }
    return NextResponse.json(parseChatbotResult(await provider.json()), { headers: responseHeaders });
  } catch (error) {
    console.error('Chatbot workflow failed', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ message: 'O assistente não conseguiu responder agora. Seus dados não foram perdidos; tente novamente ou use o formulário direto.' }, { status: 502, headers: responseHeaders });
  }
}
