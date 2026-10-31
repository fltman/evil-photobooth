// Tunna anrop mot OpenRouter: en bild in + prompt => bild ut, och bild in + prompt => bildtext.

const ENDPOINT = process.env.OPENROUTER_URL ?? 'https://openrouter.ai/api/v1/chat/completions';

export class Moderated extends Error {}

async function post(body, timeoutMs) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    if (text.includes('moderat')) throw new Moderated(text.slice(0, 200));
    const err = new Error(`OpenRouter ${res.status}: ${text.slice(0, 300)}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }
  return JSON.parse(text);
}

export async function transformImage({ model, prompt, dataUrl, aspect, timeoutMs = 60_000 }) {
  const data = await post({
    model,
    modalities: ['image'],
    image_config: { aspect_ratio: aspect },
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
  }, timeoutMs);
  const url = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(`Inget bildsvar: ${JSON.stringify(data).slice(0, 300)}`);
  return { dataUrl: url, cost: data.usage?.cost ?? 0 };
}

const REFUSAL = /\b(I can't|I cannot|I'm sorry|I am sorry|unable to|kan inte hjälpa)\b/i;

export async function writeCaption({ model, prompt, dataUrl }) {
  const body = {
    model,
    max_tokens: 200,
    reasoning: { enabled: false },
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
  };
  let data;
  try {
    data = await post(body, 12_000);
  } catch (err) {
    // Vissa modeller vägrar stänga av tänkandet. Då måste taket upp, annars blir svaret tomt.
    if (err.status !== 400 || !/reasoning/i.test(err.body ?? '')) throw err;
    delete body.reasoning;
    body.max_tokens = 2000;
    data = await post(body, 12_000);
  }
  const message = data.choices?.[0]?.message;
  const text = message?.content?.trim().replace(/^["”']|["”']$/g, '');
  if (!text || message.refusal || REFUSAL.test(text)) throw new Error(`Ingen bildtext: ${text?.slice(0, 80)}`);
  return { text, cost: data.usage?.cost ?? 0 };
}
