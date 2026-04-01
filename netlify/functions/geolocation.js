export async function handler(event) {
  const target = event.queryStringParameters?.target;
  if (!target) {
    return { statusCode: 400, body: JSON.stringify({ error: 'No target provided' }) };
  }

  // Validate that target looks like an IP address
  const isIP = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(target);
  if (!isIP) {
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ status: 'fail', message: 'Only IP addresses are supported' })
    };
  }

  try {
    const response = await fetch(
      `http://ip-api.com/json/${target}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,isp,org,as,hosting`
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
      body: JSON.stringify({ status: 'fail', message: error.message })
    };
  }
}
