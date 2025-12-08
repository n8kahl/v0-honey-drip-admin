// Quick check if Massive API is responding
const fetch = require('node-fetch');

async function testMassiveAPI() {
  try {
    const response = await fetch('http://localhost:8080/api/health');
    const health = await response.json();
    console.log('API Health:', health);
    
    // Test a simple quote fetch
    const quoteResponse = await fetch('http://localhost:8080/api/massive/v2/aggs/ticker/SPY/range/1/minute/2025-12-08/2025-12-08?limit=5', {
      headers: {
        'x-massive-proxy-token': process.env.VITE_MASSIVE_PROXY_TOKEN || ''
      }
    });
    console.log('Quote Response Status:', quoteResponse.status);
    const data = await quoteResponse.json();
    console.log('Quote Data Sample:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testMassiveAPI();
