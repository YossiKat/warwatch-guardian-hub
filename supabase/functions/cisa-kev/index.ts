const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CISA_KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '30');
    const israelOnly = url.searchParams.get('israel') === 'true';

    const resp = await fetch(CISA_KEV_URL, {
      headers: { 'Accept': 'application/json' },
    });

    if (!resp.ok) {
      throw new Error(`CISA KEV fetch failed [${resp.status}]: ${await resp.text()}`);
    }

    const data = await resp.json();
    const vulnerabilities = data.vulnerabilities || [];

    // Sort by dateAdded descending (newest first)
    const sorted = vulnerabilities
      .sort((a: any, b: any) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime())
      .slice(0, limit)
      .map((v: any) => ({
        cveID: v.cveID,
        vendorProject: v.vendorProject,
        product: v.product,
        vulnerabilityName: v.vulnerabilityName,
        shortDescription: v.shortDescription,
        dateAdded: v.dateAdded,
        dueDate: v.dueDate,
        knownRansomwareCampaignUse: v.knownRansomwareCampaignUse,
        requiredAction: v.requiredAction,
      }));

    return new Response(JSON.stringify({
      title: data.title || 'CISA Known Exploited Vulnerabilities',
      catalogVersion: data.catalogVersion,
      dateReleased: data.dateReleased,
      count: data.count,
      vulnerabilities: sorted,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('CISA KEV error:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
