export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, company, source, hubspot_company_id } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  const TOKEN = process.env.HUBSPOT_TOKEN;
  if (!TOKEN) return res.status(500).json({ error: 'HUBSPOT_TOKEN not set' });

  try {
    const r = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ properties: { email, firstname: name?.split(' ')[0] || '', lastname: name?.split(' ').slice(1).join(' ') || '', phone: phone || '', company: company || '', hs_lead_status: 'NEW' } }),
    });
    let contactId = null;
    if (r.ok) { const d = await r.json(); contactId = d.id; }
    if (contactId && hubspot_company_id) {
      await fetch('https://api.hubapi.com/crm/v3/objects/contacts/' + contactId + '/associations/companies/' + hubspot_company_id + '/contact_to_company', {
        method: 'PUT', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      }).catch(() => {});
    }
    res.status(200).json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
