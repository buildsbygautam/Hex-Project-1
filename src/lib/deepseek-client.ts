const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GROQ_API_KEY_BACKUP = import.meta.env.VITE_GROQ_API_KEY_BACKUP;
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
  const requestBody = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    stream: true,
    max_tokens: 4096,
    temperature: 0.3
  };

  try {
    let response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(requestBody),
      signal: abortSignal
    });

    // Fallback to backup key if rate limited
    if (response.status === 429 && GROQ_API_KEY_BACKUP) {
      console.log('Primary key rate limited. Falling back to backup key...');
      response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY_BACKUP}`
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal
      });
    }

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
  try {
    const isLocalhost = window.location.hostname === 'localhost';
    const apiKey = import.meta.env.VITE_VIRUSTOTAL_API_KEY;
    
    let data;
    if (isLocalhost) {
      // Direct call on localhost (no CORS issue)
      const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
      const endpoint = isIP
        ? `https://www.virustotal.com/api/v3/ip_addresses/${target}`
        : `https://www.virustotal.com/api/v3/domains/${target}`;
      const response = await fetch(endpoint, {
        headers: { 'x-apikey': apiKey }
      });
      if (!response.ok) return `VirusTotal error: ${response.status}`;
      data = await response.json();
    } else {
      // Use Netlify proxy function on deployed site
      const response = await fetch(`/.netlify/functions/virustotal?target=${encodeURIComponent(target)}`);
      if (!response.ok) return `VirusTotal error: ${response.status}`;
      data = await response.json();
    }

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
  const ipMatch = message.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  if (ipMatch) return ipMatch[0];
  // Match domain
  const domainMatch = message.match(/\b[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}\b/);
  if (domainMatch) return domainMatch[0];
  return null;
}

export async function queryGeolocation(target: string): Promise<string> {
  try {
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
    if (!isIP) return `Geolocation: Only available for IP addresses, not domains.`;
    
    const isLocalhost = window.location.hostname === 'localhost';
    let data;

    if (isLocalhost) {
      // Direct call on localhost (http is fine locally)
      const response = await fetch(`http://ip-api.com/json/${target}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,isp,org,as,hosting`);
      data = await response.json();
    } else {
      // Use Netlify proxy function on deployed site (avoids HTTP/HTTPS mixed content)
      const response = await fetch(`/.netlify/functions/geolocation?target=${encodeURIComponent(target)}`);
      data = await response.json();
    }
    
    if (data.status === 'fail') return `Geolocation: Could not locate ${target}`;
    
    return `GEOLOCATION FOR ${target}:
Country: ${data.country} (${data.countryCode})
Region: ${data.regionName}
City: ${data.city}
Coordinates: ${data.lat}, ${data.lon}
ISP: ${data.isp}
Organization: ${data.org}
Hosting Provider: ${data.hosting ? 'Yes - likely a server/datacenter' : 'No - likely an end user'}
ASN: ${data.as}`;
  } catch (error) {
    return `Geolocation: Could not fetch location data for ${target}`;
  }
}

export function calculateRiskScore(vtData: string, geoData: string): number {
  let score = 0;

  // Extract malicious detections (weight: 40 points max)
  const maliciousMatch = vtData.match(/Malicious Detections: (\d+)/);
  const malicious = maliciousMatch ? parseInt(maliciousMatch[1]) : 0;
  score += Math.min(malicious * 4, 40);

  // Extract suspicious detections (weight: 20 points max)
  const suspiciousMatch = vtData.match(/Suspicious Detections: (\d+)/);
  const suspicious = suspiciousMatch ? parseInt(suspiciousMatch[1]) : 0;
  score += Math.min(suspicious * 2, 20);

  // Reputation score (weight: 20 points max)
  const reputationMatch = vtData.match(/Reputation Score: (-?\d+)/);
  const reputation = reputationMatch ? parseInt(reputationMatch[1]) : 0;
  if (reputation < 0) score += 20;
  else if (reputation < 10) score += 10;
  else if (reputation < 50) score += 5;

  // Hosting provider penalty (weight: 10 points)
  if (geoData.includes('Yes - likely a server/datacenter')) score += 10;

  // Country risk factor (weight: 10 points)
  const highRiskCountries = ['RU', 'CN', 'KP', 'IR', 'NG'];
  const countryMatch = geoData.match(/Country: .+ \(([A-Z]{2})\)/);
  if (countryMatch && highRiskCountries.includes(countryMatch[1])) score += 10;

  return Math.min(score, 100);
}

export function getRiskLabel(score: number): string {
  if (score >= 70) return 'CRITICAL';
  if (score >= 40) return 'HIGH';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
}

export async function queryWhois(target: string): Promise<string> {
  try {
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
    if (isIP) return `WHOIS: WHOIS lookup is for domains only, not IP addresses.`;

    const isLocalhost = window.location.hostname === 'localhost';
    let data;

    if (isLocalhost) {
      const apiKey = import.meta.env.VITE_WHOIS_API_KEY;
      const response = await fetch(
        `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${target}&outputFormat=JSON`
      );
      data = await response.json();
    } else {
      const response = await fetch(`/.netlify/functions/whois?target=${encodeURIComponent(target)}`);
      data = await response.json();
    }

    const record = data.WhoisRecord;
    if (!record) return `WHOIS: No data found for ${target}`;

    const registrar = record.registrarName || 'Unknown';
    const created = record.createdDate || 'Unknown';
    const expires = record.expiresDate || 'Unknown';
    const updated = record.updatedDate || 'Unknown';
    const registrant = record.registrant?.organization || record.registrant?.name || 'Hidden/Private';
    const country = record.registrant?.country || 'Unknown';
    const nameServers = record.nameServers?.hostNames?.slice(0, 3).join(', ') || 'Unknown';

    return `WHOIS DATA FOR ${target}:
Registrar: ${registrar}
Registrant: ${registrant}
Country: ${country}
Created: ${created}
Expires: ${expires}
Last Updated: ${updated}
Name Servers: ${nameServers}`;
  } catch (error) {
    return `WHOIS: Could not fetch data for ${target}`;
  }
}