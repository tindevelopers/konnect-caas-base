import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

type DealStage = { id: string; name: string; position: number };

function pick<T>(arr: T[], idx: number): T {
  return arr[idx % arr.length];
}

async function main() {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
  dotenv.config({ path: path.resolve(process.cwd(), "apps/tenant/.env.local") });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env (.env.local / apps/tenant/.env.local)."
    );
  }

  const tenantName = "Pet Store Direct";
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tenantRes = await supabase
    .from("tenants")
    .select("id,name")
    .ilike("name", tenantName)
    .limit(2);
  if (tenantRes.error) throw tenantRes.error;
  if (!tenantRes.data?.length) throw new Error(`Tenant not found by name: ${tenantName}`);
  if (tenantRes.data.length > 1) throw new Error(`Multiple tenants matched name: ${tenantName}`);
  const tenantId = tenantRes.data[0].id as string;

  // created_by: choose any tenant user (best-effort)
  const userRes = await supabase
    .from("users")
    .select("id,email")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1);
  const createdBy = userRes.data?.[0]?.id ?? null;

  // Ensure deal stages exist (some tenants may not have been initialized yet).
  const stagesRes = await supabase
    .from("deal_stages")
    .select("id,name,position")
    .eq("tenant_id", tenantId)
    .order("position", { ascending: true });
  if (stagesRes.error) throw stagesRes.error;

  let stages = (stagesRes.data ?? []) as DealStage[];
  if (stages.length === 0) {
    const defaultStages = [
      { name: "Lead", position: 0, color: "#3b82f6", is_closed: false },
      { name: "Qualified", position: 1, color: "#6366f1", is_closed: false },
      { name: "Proposal", position: 2, color: "#8b5cf6", is_closed: false },
      { name: "Negotiation", position: 3, color: "#f59e0b", is_closed: false },
      { name: "Won", position: 4, color: "#22c55e", is_closed: true },
    ];

    const insStages = await supabase
      .from("deal_stages")
      .insert(
        defaultStages.map((s) => ({
          tenant_id: tenantId,
          name: s.name,
          position: s.position,
          color: s.color,
          is_closed: s.is_closed,
        }))
      )
      .select("id,name,position");
    if (insStages.error) throw insStages.error;
    stages = (insStages.data ?? []) as DealStage[];
  }

  // Fetch groomer contacts to relate deals to.
  const contactsRes = await supabase
    .from("contacts")
    .select("id,first_name,last_name,email")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (contactsRes.error) throw contactsRes.error;
  const contacts = contactsRes.data ?? [];
  if (contacts.length < 10) {
    throw new Error(
      `Need at least 10 contacts in "${tenantName}" to relate deals, found ${contacts.length}.`
    );
  }

  const companies = [
    {
      name: "Pawfect Style Grooming Co.",
      website: "https://pawfectstyle.example",
      industry: "Pet Services",
      phone: "+16465550201",
      email: "hello@pawfectstyle.example",
      tags: ["grooming", "partner", "seed", "pet-store-direct"],
    },
    {
      name: "Bark & Bubble Mobile Grooming",
      website: "https://barkandbubble.example",
      industry: "Pet Services",
      phone: "+16465550202",
      email: "appointments@barkandbubble.example",
      tags: ["mobile-grooming", "seed", "pet-store-direct"],
    },
    {
      name: "WhiskerWash Cat Grooming Studio",
      website: "https://whiskerwash.example",
      industry: "Pet Services",
      phone: "+16465550203",
      email: "cats@whiskerwash.example",
      tags: ["cat-grooming", "seed", "pet-store-direct"],
    },
    {
      name: "Doodle Dreams Grooming Bar",
      website: "https://doodledreams.example",
      industry: "Pet Services",
      phone: "+16465550204",
      email: "doodles@doodledreams.example",
      tags: ["doodles", "seed", "pet-store-direct"],
    },
    {
      name: "The Snip & Treat Salon",
      website: "https://snipandtreat.example",
      industry: "Pet Services",
      phone: "+16465550205",
      email: "frontdesk@snipandtreat.example",
      tags: ["salon", "seed", "pet-store-direct"],
    },
    {
      name: "Coat & Claws Grooming Supply",
      website: "https://coatandclaws.example",
      industry: "Retail",
      phone: "+16465550206",
      email: "sales@coatandclaws.example",
      tags: ["supplies", "retail", "seed", "pet-store-direct"],
    },
    {
      name: "Shiny Paws Training + Grooming",
      website: "https://shinypaws.example",
      industry: "Pet Services",
      phone: "+16465550207",
      email: "team@shinypaws.example",
      tags: ["training", "grooming", "seed", "pet-store-direct"],
    },
    {
      name: "PuppyCuts Express",
      website: "https://puppycuts.example",
      industry: "Pet Services",
      phone: "+16465550208",
      email: "bookings@puppycuts.example",
      tags: ["express", "seed", "pet-store-direct"],
    },
    {
      name: "TailWag Spa & Groom",
      website: "https://tailwagspa.example",
      industry: "Pet Services",
      phone: "+16465550209",
      email: "spa@tailwagspa.example",
      tags: ["spa", "seed", "pet-store-direct"],
    },
    {
      name: "GroomRoom Franchise - Midtown",
      website: "https://groomroommidtown.example",
      industry: "Pet Services",
      phone: "+16465550210",
      email: "midtown@groomroom.example",
      tags: ["franchise", "seed", "pet-store-direct"],
    },
  ] as const;

  let insertedCompanies = 0;
  const companyIds: string[] = [];

  for (const c of companies) {
    const existing = await supabase
      .from("companies")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", c.name)
      .maybeSingle();
    if (existing.data?.id) {
      companyIds.push(existing.data.id);
      continue;
    }

    const ins = await supabase
      .from("companies")
      .insert({
        tenant_id: tenantId,
        name: c.name,
        website: c.website,
        industry: c.industry,
        phone: c.phone,
        email: c.email,
        tags: c.tags,
        created_by: createdBy,
      })
      .select("id")
      .single();
    if (ins.error) throw ins.error;
    companyIds.push((ins.data as any).id);
    insertedCompanies++;
  }

  // Deals: 10, tied to groomer contacts + companies
  let insertedDeals = 0;
  let skippedDeals = 0;

  const dealTemplates = [
    (who: string, company: string) => `Salon Partnership Setup — ${company} (${who})`,
    (who: string, company: string) => `Monthly Grooming Contract — ${company}`,
    (who: string, company: string) => `Mobile Grooming Routing Pilot — ${company}`,
    (who: string, company: string) => `New Client Intake Automation — ${company}`,
    (who: string, company: string) => `Upsell Campaign: Add-on Services — ${company}`,
  ];

  for (let i = 0; i < 10; i++) {
    const contact = contacts[i] as any;
    const companyId = companyIds[i];
    const companyName = companies[i].name;
    const who = `${contact.first_name} ${contact.last_name}`;
    const stage = pick(stages, i);
    const name = pick(dealTemplates, i)(who, companyName);

    const existing = await supabase
      .from("deals")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("name", name)
      .maybeSingle();
    if (existing.data?.id) {
      skippedDeals++;
      continue;
    }

    const value = 2500 + i * 750;
    const probability = Math.min(95, 25 + i * 7);

    const ins = await supabase.from("deals").insert({
      tenant_id: tenantId,
      contact_id: contact.id,
      company_id: companyId,
      name,
      stage_id: stage.id,
      value,
      currency: "USD",
      probability,
      description: `Seed deal for grooming workflow testing. Primary contact: ${who}.`,
      tags: ["grooming", "seed", "pet-store-direct"],
      created_by: createdBy,
      assigned_to: createdBy,
    });

    if (ins.error) throw ins.error;
    insertedDeals++;
  }

  console.log(
    `Seeded companies + deals for "${tenantName}". companies_inserted=${insertedCompanies} deals_inserted=${insertedDeals} deals_skipped_existing=${skippedDeals} stages_available=${stages.length}`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

