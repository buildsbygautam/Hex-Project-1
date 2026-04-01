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
  const getRequestBody = (model: string) => ({
    model: model,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages
    ],
    stream: true,
    max_tokens: 4096,
    temperature: 0.3
  });

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-70b-versatile', 'llama-3.1-8b-instant'];

  try {
    let response: Response | null = null;

    // First try: Primary Key with Best Model
    response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify(getRequestBody(models[0])),
      signal: abortSignal
    });

    // Second try: Backup Key with Best Model if 429
    if (response.status === 429 && GROQ_API_KEY_BACKUP) {
      console.log('Primary key rate limited. Trying backup key...');
      response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY_BACKUP}`
        },
        body: JSON.stringify(getRequestBody(models[0])),
        signal: abortSignal
      });
    }

    // Third try: Primary Key with smaller model (Instant) if still 429
    if (response.status === 429) {
      console.log('70B model rate limited. Falling back to 8B-instant model...');
      response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify(getRequestBody(models[2])),
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

export function extractTarget(message: string): string | null {
  const ipMatch = message.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
  if (ipMatch) return ipMatch[0];
  const domainMatch = message.match(/\b[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}\b/);
  if (domainMatch) return domainMatch[0];
  return null;
}

export async function queryVirusTotal(target: string): Promise<string> {
  try {
    const isLocalhost = window.location.hostname === 'localhost';
    const apiKey = import.meta.env.VITE_VIRUSTOTAL_API_KEY;
    
    let data;
    if (isLocalhost) {
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

export async function queryGeolocation(target: string): Promise<string> {
  try {
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
    if (!isIP) return `Geolocation: Only available for IP addresses, not domains.`;
    
    const isLocalhost = window.location.hostname === 'localhost';
    let data;

    if (isLocalhost) {
      const response = await fetch(`http://ip-api.com/json/${target}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,isp,org,as,hosting`);
      data = await response.json();
    } else {
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

export async function queryShodan(target: string): Promise<string> {
  try {
    const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
    if (!isIP) return `SHODAN: Shodan lookup is only supported for IP addresses.`;

    const isLocalhost = window.location.hostname === 'localhost';
    let data;

    if (isLocalhost) {
      const apiKey = import.meta.env.VITE_SHODAN_API_KEY;
      if (!apiKey) return `SHODAN: API key not configured.`;
      const response = await fetch(`/shodan-proxy/shodan/host/${target}?key=${apiKey}`);
      if (!response.ok) return `SHODAN: No data available for ${target}. Status: ${response.status}`;
      data = await response.json();
    } else {
      const response = await fetch(`/.netlify/functions/shodan?ip=${target}`);
      if (!response.ok) return `SHODAN: Remote proxy error ${response.status}.`;
      data = await response.json();
    }
    
    if (data.error) return `SHODAN: ${data.error}`;
    
    const ports = (data.ports || []).join(', ');
    const vulns = (data.vulns || []).join(', ');
    
    return `SHODAN DATA FOR ${target}:\n- Open Ports: ${ports || 'None detected'}\n- Known Vulnerabilities (CVEs): ${vulns || 'None detected'}`;
  } catch (error: any) {
    return `SHODAN: Could not retrieve data.`;
  }
}

export async function queryWhois(target: string): Promise<string> {
  try {
    const isLocalhost = window.location.hostname === 'localhost';
    const proxyUrl = isLocalhost ? `/whois-proxy/domain/${target}` : `https://rdap.org/domain/${target}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) return `WHOIS: No registration data available for ${target}. Status: ${response.status}`;
    
    const data = await response.json();
    let registrar = 'Unknown';
    let createdDate = 'Unknown';
    
    if (data.entities && data.entities.length > 0) {
      let regEntity = data.entities.find((e: any) => e.roles && e.roles.includes('registrar'));
      if (!regEntity) regEntity = data.entities.find((e: any) => e.vcardArray || e.handle);

      if (regEntity) {
        if (regEntity.vcardArray && regEntity.vcardArray[1]) {
          const fn = regEntity.vcardArray[1].find((v: any) => v[0] === 'fn');
          if (fn) registrar = fn[3];
        } else if (regEntity.handle) {
          registrar = regEntity.handle;
        }
      }
    }
    
    if (data.events && data.events.length > 0) {
      const regEvent = data.events.find((e: any) => e.eventAction === 'registration' || e.eventAction === 'last changed');
      if (regEvent) createdDate = new Date(regEvent.eventDate).toLocaleDateString();
    }
    
    return `WHOIS DATA FOR ${target}:\n- Registrar: ${registrar}\n- Created: ${createdDate}\n\n[RDAP RAW]: ${JSON.stringify(data).substring(0, 500)}`;
  } catch (error: any) {
    return `WHOIS: Could not retrieve registration data.`;
  }
}

export function calculateRiskScore(vtData: string, geoData: string, shodanData: string = ""): number {
  let score = 0;
  const maliciousMatch = vtData.match(/Malicious Detections: (\d+)/);
  const malicious = maliciousMatch ? parseInt(maliciousMatch[1]) : 0;
  score += Math.min(malicious * 4, 40);

  const suspiciousMatch = vtData.match(/Suspicious Detections: (\d+)/);
  const suspicious = suspiciousMatch ? parseInt(suspiciousMatch[1]) : 0;
  score += Math.min(suspicious * 2, 20);

  const reputationMatch = vtData.match(/Reputation Score: (-?\d+)/);
  const reputation = reputationMatch ? parseInt(reputationMatch[1]) : 0;
  if (reputation < 0) score += 20;
  else if (reputation < 10) score += 10;
  else if (reputation < 50) score += 5;

  if (geoData.includes('Yes - likely a server/datacenter')) score += 5;

  const highRiskCountries = ['RU', 'CN', 'KP', 'IR', 'NG'];
  const countryMatch = geoData.match(/Country: .+ \(([A-Z]{2})\)/);
  if (countryMatch && highRiskCountries.includes(countryMatch[1])) score += 5;

  if (shodanData.includes('Known Vulnerabilities')) {
    const vulnsMatch = shodanData.match(/Known Vulnerabilities \(CVEs\): (.+)/);
    if (vulnsMatch && vulnsMatch[1] !== 'None detected') {
      score += 15;
    }
  }
  
  if (shodanData.includes('Open Ports:')) {
    const riskyPorts = ['21', '22', '23', '3389', '445', '1433', '3306'];
    const portsMatch = shodanData.match(/Open Ports: (.+)/);
    if (portsMatch && portsMatch[1] !== 'None detected') {
      const openPorts = portsMatch[1].split(',').map(p => p.trim());
      if (openPorts.some(p => riskyPorts.includes(p))) score += 10;
      else if (openPorts.length > 0) score += 5;
    }
  }

  return Math.min(score, 100);
}

export function getRiskLabel(score: number): string {
  if (score >= 70) return 'CRITICAL';
  if (score >= 40) return 'HIGH';
  if (score >= 20) return 'MEDIUM';
  return 'LOW';
}