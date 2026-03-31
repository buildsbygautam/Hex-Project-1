const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function sendToDeepSeek(
  messages: Message[],
  systemPrompt: string,
  onChunk: (text: string) => void,
  onComplete: () => void,
  onError: (error: Error) => void,
  abortSignal?: AbortSignal
) {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        stream: true,
        max_tokens: 4000,
        temperature: 0.3
      }),
      signal: abortSignal
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            onComplete();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) onChunk(text);
          } catch {
            // skip unparseable chunks
          }
        }
      }
    }
    onComplete();
  } catch (error: any) {
    if (error.name === 'AbortError') return;
    onError(error);
  }
}

export async function queryVirusTotal(target: string): Promise<string> {
  const apiKey = import.meta.env.VITE_VIRUSTOTAL_API_KEY;
  try {
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
    const endpoint = isIP
      ? `https://www.virustotal.com/api/v3/ip_addresses/${target}`
      : `https://www.virustotal.com/api/v3/domains/${target}`;
    const response = await fetch(endpoint, {
      headers: { 'x-apikey': apiKey }
    });
    if (!response.ok) return `VirusTotal error: ${response.status}`;
    const data = await response.json();
    const stats = data.data?.attributes?.last_analysis_stats;
    const reputation = data.data?.attributes?.reputation || 0;
    const malicious = stats?.malicious || 0;
    const suspicious = stats?.suspicious || 0;
    const harmless = stats?.harmless || 0;
    const undetected = stats?.undetected || 0;
    const categories = data.data?.attributes?.categories || {};
    const categoryList = Object.values(categories).join(', ') || 'None';
    return `VIRUSTOTAL RESULTS FOR ${target}:
Reputation Score: ${reputation}
Malicious Detections: ${malicious}
Suspicious Detections: ${suspicious}
Harmless Votes: ${harmless}
Undetected: ${undetected}
Categories: ${categoryList}
Verdict: ${malicious > 5 ? '🚨 MALICIOUS' : malicious > 0 ? '⚠️ SUSPICIOUS' : suspicious > 0 ? '⚠️ SUSPICIOUS' : '✅ CLEAN'}`;
  } catch (error) {
    return `Could not fetch VirusTotal data for ${target}`;
  }
}

export function extractTarget(message: string): string | null {
  // Match full IP address
  const ipMatch = message.match(/\b(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\b/);
  if (ipMatch) {
    return `${ipMatch[1]}.${ipMatch[2]}.${ipMatch[3]}.${ipMatch[4]}`;
  }
  // Match domain
  const domainMatch = message.match(/\b([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/);
  if (domainMatch) return domainMatch[0];
  return null;
}