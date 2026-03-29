const https = require('https');

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, company, source, hubspot_company_id } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const token = process.env.HUBSPOT_TOKEN;
  if (!token) return res.status(500).json({ error: 'HubSpot not configured' });

  try {
    // Build contact properties
    const properties = { email };
    if (name) {
      const parts = name.split(' ');
      properties.firstname = parts[0];
      if (parts.length > 1) properties.lastname = parts.slice(1).join(' ');
    }
    if (phone) properties.phone = phone;
    if (company) properties.company = company;
    properties.hs_lead_status = 'NEW';

    // Create contact in HubSpot
    const contactResult = await hubspotRequest('POST', '/crm/v3/objects/contacts', token, { properties });

    // Associate with company if provided
    if (hubspot_company_id && contactResult.id) {
      try {
        await hubspotRequest(
          'PUT',
          `/crm/v3/objects/contacts/${contactResult.id}/associations/companies/${hubspot_company_id}/contact_to_company`,
          token
        );
      } catch (e) {
        // Association failed but contact was created — still a success
      }
    }

    return res.status(200).json({ success: true, message: 'Lead captured' });
  } catch (err) {
    // If contact already exists, that's still OK
    if (err.message && (err.message.includes('already exists') || err.message.includes('CONFLICT'))) {
      return res.status(200).json({ success: true, message: 'Contact already exists' });
    }
    return res.status(500).json({ error: 'Failed to capture lead: ' + err.message });
  }
};

function hubspotRequest(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.hubapi.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
          else reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
        } catch {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve({});
          else reject(new Error(`HTTP ${res.statusCode}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}
