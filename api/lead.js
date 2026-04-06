export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const lead = req.body;
    const supabaseUrl = "https://gepqxzditulkounsdcly.supabase.co";
    const supabaseKey = "sb_publishable_QN45BlmC-n5n6LeklHZBaA_sTeUhoZf";
    const hubspotToken = process.env.HUBSPOT_TOKEN || "";

    const leadId = "lead-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    const firstName = lead.firstName || lead.name || "";
    const lastName = lead.lastName || "";

    // 1. Save to Supabase (only columns that exist in the Lead table)
    const supabaseRes = await fetch(supabaseUrl + "/rest/v1/Lead", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: "Bearer " + supabaseKey,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: leadId,
        email: lead.email || "",
        firstName: firstName,
        lastName: lastName,
        company: lead.company || null,
        phone: lead.phone || null,
        source: lead.source || "landing-page",
        segment: "NEW",
        score: 0,
        stage: "NEW",
        updatedAt: new Date().toISOString(),
      }),
    });

    if (!supabaseRes.ok) {
      const err = await supabaseRes.text();
      console.error("Supabase error:", err);
      return res.status(500).json({ error: "Failed to save lead", detail: err });
    }
    const saved = await supabaseRes.json();

    // 2. Push to HubSpot CRM
    let hubspotContactId = null;
    if (hubspotToken && lead.email) {
      try {
        // Search existing
        const searchRes = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
          method: "POST",
          headers: { Authorization: "Bearer " + hubspotToken, "Content-Type": "application/json" },
          body: JSON.stringify({
            filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: lead.email }] }],
            limit: 1,
          }),
        });
        if (searchRes.ok) {
          const sd = await searchRes.json();
          if (sd.total > 0) {
            hubspotContactId = sd.results[0].id;
            await fetch("https://api.hubapi.com/crm/v3/objects/contacts/" + hubspotContactId, {
              method: "PATCH",
              headers: { Authorization: "Bearer " + hubspotToken, "Content-Type": "application/json" },
              body: JSON.stringify({ properties: { firstname: firstName, lastname: lastName, phone: lead.phone || "", company: lead.company || "" } }),
            });
          }
        }
        // Create if not found
        if (!hubspotContactId) {
          const cr = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
            method: "POST",
            headers: { Authorization: "Bearer " + hubspotToken, "Content-Type": "application/json" },
            body: JSON.stringify({
              properties: {
                email: lead.email, firstname: firstName, lastname: lastName,
                phone: lead.phone || "", company: lead.company || "",
                lifecyclestage: "lead",
              },
            }),
          });
          if (cr.ok) {
            const cd = await cr.json();
            hubspotContactId = cd.id;
            if (lead.hubspotCompanyId) {
              await fetch(
                "https://api.hubapi.com/crm/v3/objects/contacts/" + hubspotContactId + "/associations/companies/" + lead.hubspotCompanyId + "/contact_to_company",
                { method: "PUT", headers: { Authorization: "Bearer " + hubspotToken } }
              ).catch(function(){});
            }
          }
        }
      } catch (e) { console.error("HubSpot error:", e); }
    }
    return res.status(200).json({ success: true, leadId: saved[0] ? saved[0].id : leadId, hubspotContactId });
  } catch (err) { console.error("Lead capture error:", err); return res.status(500).json({ error: "Internal server error" }); }
}
