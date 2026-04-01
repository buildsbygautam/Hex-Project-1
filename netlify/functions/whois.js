export async function handler(event) {
  const target = event.queryStringParameters?.target;
  if (!target) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No target provided' }) };
  }

  const apiKey = process.env.VITE_WHOIS_API_KEY;
  
  try {
    const response = await fetch(
      `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${target}&outputFormat=JSON`
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