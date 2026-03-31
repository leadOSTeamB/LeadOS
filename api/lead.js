export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).json({ success: false, error: 'Use POST' });

  try {
    const { name, email, phone, company, source, hubspot_company_id } = req.body || {};
    if (!email) return res.status(200).json({ success: false, error: 'Email required' });

    const TOKEN = process.env.HUBSPOT_TOKEN;
    if (!TOKEN) return res.status(200).json({ success: false, error: 'HubSpot token not configured' });

    const contactRes = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        properties: {
          email: email,
          firstname: (name || '').split(' ')[0] || '',
          lastname: (name || '').split(' ').slice(1).join(' ') || '',
          phone: phone || '',
          company: company || '',
          hs_lead_status: 'NEW',
        }
      }),
    });

    const contactData = await contactRes.json();
    let contactId = contactData.id || null;

    if (!contactRes.ok) {
      if (contactRes.status === 409) {
        contactId = contactData.message?.match(/ID: (\d+)/)?.[1] || null;
      } else {
        return res.status(200).json({ success: false, error: 'HubSpot: ' + (contactData.message || 'Failed to create contact') });
      }
    }

    if (contactId && hubspot_company_id) {
      await fetch('https://api.hubapi.com/crm/v3/objects/contacts/' + contactId + '/associations/companies/' + hubspot_company_id + '/contact_to_company', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
      }).catch(() => {});
    }

    return res.status(200).json({ success: true, contactId: contactId });
  } catch (err) {
    return res.status(200).json({ success: false, error: err.message });
  }
}
