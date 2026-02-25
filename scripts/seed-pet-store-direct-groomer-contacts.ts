import dotenv from "dotenv";
import path from "node:path";
import process from "node:process";
import { createClient } from "@supabase/supabase-js";

type SeedContact = {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  mobile?: string;
  job_title?: string;
  department?: string;
  tags?: string[];
  notes?: string;
};

function slugifyEmailLocalPart(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 50);
}

function makePhone(i: number) {
  // +1 646-555-01xx range
  const suffix = String(10 + (i % 90)).padStart(2, "0");
  return `+164655501${suffix}`;
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

  const tenants = tenantRes.data ?? [];
  if (tenants.length === 0) throw new Error(`Tenant not found by name: ${tenantName}`);
  if (tenants.length > 1) throw new Error(`Multiple tenants matched name: ${tenantName}`);
  const tenantId = tenants[0].id as string;

  // Use any user in this tenant as created_by (best-effort).
  const userRes = await supabase
    .from("users")
    .select("id,email")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1);
  const createdBy = userRes.data?.[0]?.id ?? null;

  const baseNames: Array<[string, string]> = [
    ["Avery", "Brooks"],
    ["Mia", "Santos"],
    ["Jordan", "Reed"],
    ["Chloe", "Nguyen"],
    ["Sofia", "Martinez"],
    ["Noah", "Bennett"],
    ["Harper", "Collins"],
    ["Ethan", "Foster"],
    ["Luna", "Kim"],
    ["Olivia", "Patel"],
    ["Amelia", "Johnson"],
    ["Jackson", "Lee"],
    ["Isla", "Murphy"],
    ["Mateo", "Rivera"],
    ["Grace", "Cooper"],
    ["Emma", "Chen"],
    ["Logan", "Davis"],
    ["Nora", "Hughes"],
    ["Ella", "Morgan"],
    ["Zoey", "Turner"],
  ];

  const seed: SeedContact[] = baseNames.slice(0, 20).map(([first, last], idx) => {
    const local = slugifyEmailLocalPart(`${first}.${last}.grooming.test${idx + 1}`);
    return {
      first_name: first,
      last_name: last,
      email: `${local}@petstoredirect.test`,
      phone: makePhone(idx),
      mobile: makePhone(idx + 50),
      job_title: idx % 5 === 0 ? "Lead Groomer" : idx % 7 === 0 ? "Salon Manager" : "Pet Groomer",
      department: "Grooming",
      tags: ["groomer", "seed", "pet-store-direct"],
      notes:
        idx % 4 === 0
          ? "Specializes in nervous dogs and first-time grooms."
          : idx % 4 === 1
            ? "Prefers morning appointments; great with doodles."
            : idx % 4 === 2
              ? "Cat grooming experience; handles sedation protocols (if needed)."
              : "Focus on small breeds; excellent customer communication.",
    };
  });

  let inserted = 0;
  let skipped = 0;

  for (const c of seed) {
    const existingRes = await supabase
      .from("contacts")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("email", c.email)
      .maybeSingle();
    if (existingRes.data?.id) {
      skipped++;
      continue;
    }

    const insRes = await supabase.from("contacts").insert({
      tenant_id: tenantId,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone ?? null,
      mobile: c.mobile ?? null,
      job_title: c.job_title ?? null,
      department: c.department ?? null,
      tags: c.tags ?? null,
      notes: c.notes ?? null,
      created_by: createdBy,
    });

    if (insRes.error) {
      throw insRes.error;
    }
    inserted++;
  }

  console.log(
    `Seeded groomer contacts for "${tenantName}". inserted=${inserted} skipped_existing=${skipped}`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

