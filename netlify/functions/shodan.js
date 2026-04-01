export async function handler(event) {
  const target = event.queryStringParameters?.target;
  if (!target) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No target provided' }) };
  }

  // Shodan requires IP addresses, not domains
  const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
  if (!isIP) {
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Shodan only supports IP addresses' })
    };
  }

  const apiKey = process.env.VITE_SHODAN_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'Shodan API key is not configured' })
    };
  }

  try {
    const response = await fetch(
      `https://api.shodan.io/shodan/host/${target}?key=${apiKey}`
    );
    const data = await response.json();
    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
}
