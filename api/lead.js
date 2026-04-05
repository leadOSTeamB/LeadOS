export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const lead = req.body;
    const supabaseUrl = "https://gepqxzditulkounsdcly.supabase.co";
    const supabaseKey = "sb_publishable_QN45BlmC-n5n6LeklHZBaA_sTeUhoZf";

    // Insert lead into Supabase
    const response = await fetch(`${supabaseUrl}/rest/v1/Lead`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        email: lead.email || "",
        firstName: lead.firstName || lead.name?.split(" ")[0] || "",
        lastName: lead.lastName || lead.name?.split(" ").slice(1).join(" ") || "",
        company: lead.company || "",
        phone: lead.phone || "",
        source: lead.source || "landing-page",
        landingPage: lead.landingPage || "",
        segment: "NEW",
        score: 0,
        stage: "NEW",
        metadata: lead,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Supabase error:", err);
      return res.status(500).json({ error: "Failed to save lead" });
    }

    const saved = await response.json();
    return res.status(200).json({ success: true, leadId: saved[0]?.id });
  } catch (err) {
    console.error("Lead capture error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
