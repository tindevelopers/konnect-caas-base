"use server";

import { createClient } from "@/core/database/server";
import { getTenantForCrm } from "./tenant-helper";

const SEED_CONTACTS = [
  {
    first_name: "Sarah",
    last_name: "Chen",
    email: "sarah.chen@acmecorp.com",
    phone: "+12125551001",
    mobile: "+12125559001",
    job_title: "VP of Operations",
    department: "Operations",
    tags: ["vip", "enterprise"],
  },
  {
    first_name: "Marcus",
    last_name: "Johnson",
    email: "marcus.j@techstart.io",
    phone: "+13105551002",
    mobile: "+13105559002",
    job_title: "CTO",
    department: "Engineering",
    tags: ["tech", "decision-maker"],
  },
  {
    first_name: "Emily",
    last_name: "Rodriguez",
    email: "emily.r@greenleaf.co",
    phone: "+14155551003",
    mobile: "+14155559003",
    job_title: "Marketing Director",
    department: "Marketing",
    tags: ["marketing", "warm-lead"],
  },
  {
    first_name: "David",
    last_name: "Kim",
    email: "dkim@blueocean.com",
    phone: "+17185551004",
    mobile: "+17185559004",
    job_title: "CEO",
    department: "Executive",
    tags: ["vip", "decision-maker"],
  },
  {
    first_name: "Jessica",
    last_name: "Patel",
    email: "jpatel@sunrisehealthcare.org",
    phone: "+16465551005",
    mobile: "+16465559005",
    job_title: "Practice Manager",
    department: "Administration",
    tags: ["healthcare", "warm-lead"],
  },
  {
    first_name: "Robert",
    last_name: "Thompson",
    email: "rthompson@buildright.com",
    phone: "+12815551006",
    mobile: "+12815559006",
    job_title: "Project Manager",
    department: "Construction",
    tags: ["construction", "follow-up"],
  },
  {
    first_name: "Amanda",
    last_name: "Foster",
    email: "amanda.foster@legaledge.com",
    phone: "+13125551007",
    mobile: "+13125559007",
    job_title: "Managing Partner",
    department: "Legal",
    tags: ["legal", "vip"],
  },
  {
    first_name: "James",
    last_name: "Wright",
    email: "jwright@pinnaclefi.com",
    phone: "+14695551008",
    mobile: "+14695559008",
    job_title: "Financial Advisor",
    department: "Finance",
    tags: ["finance", "enterprise"],
  },
  {
    first_name: "Lisa",
    last_name: "Nguyen",
    email: "lisa.n@creativepulse.co",
    phone: "+15035551009",
    mobile: "+15035559009",
    job_title: "Creative Director",
    department: "Design",
    tags: ["creative", "warm-lead"],
  },
  {
    first_name: "Michael",
    last_name: "O'Brien",
    email: "mobrien@atlaslogistics.com",
    phone: "+16175551010",
    mobile: "+16175559010",
    job_title: "Operations Director",
    department: "Logistics",
    tags: ["logistics", "decision-maker"],
  },
];

const SEED_GROUPS = [
  {
    name: "VIP Clients",
    description: "High-value clients requiring priority outreach",
    color: "#eab308",
    contactTags: ["vip"],
  },
  {
    name: "Decision Makers",
    description: "C-level and senior decision makers",
    color: "#ef4444",
    contactTags: ["decision-maker"],
  },
  {
    name: "Warm Leads",
    description: "Contacts who have shown interest",
    color: "#22c55e",
    contactTags: ["warm-lead"],
  },
];

/**
 * Seed 10 sample contacts and 3 groups into the current tenant's CRM.
 * Skips contacts whose email already exists to avoid duplicates.
 */
export async function seedCrmContacts(): Promise<
  { ok: true; contacts: number; groups: number } | { ok: false; error: string }
> {
  try {
    const tenantId = await getTenantForCrm();
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let insertedContacts = 0;

    // Insert contacts (skip duplicates by email)
    const contactIdMap: Record<string, string> = {};

    for (const c of SEED_CONTACTS) {
      const { data: existing } = await (supabase.from("contacts") as any)
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("email", c.email)
        .maybeSingle();

      if (existing) {
        contactIdMap[c.email] = existing.id;
        continue;
      }

      const { data, error } = await (supabase.from("contacts") as any)
        .insert({
          tenant_id: tenantId,
          first_name: c.first_name,
          last_name: c.last_name,
          email: c.email,
          phone: c.phone,
          mobile: c.mobile,
          job_title: c.job_title,
          department: c.department,
          tags: c.tags,
          created_by: user?.id || null,
        })
        .select("id")
        .single();

      if (error) {
        console.error(`Seed contact ${c.email}:`, error);
        continue;
      }

      contactIdMap[c.email] = data.id;
      insertedContacts++;
    }

    // Insert groups and assign members
    let insertedGroups = 0;

    for (const g of SEED_GROUPS) {
      // Check if group already exists
      const { data: existingGroup } = await (
        supabase.from("contact_groups") as any
      )
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("name", g.name)
        .maybeSingle();

      let groupId: string;

      if (existingGroup) {
        groupId = existingGroup.id;
      } else {
        const { data: newGroup, error: groupError } = await (
          supabase.from("contact_groups") as any
        )
          .insert({
            tenant_id: tenantId,
            name: g.name,
            description: g.description,
            color: g.color,
            created_by: user?.id || null,
          })
          .select("id")
          .single();

        if (groupError) {
          console.error(`Seed group ${g.name}:`, groupError);
          continue;
        }
        groupId = newGroup.id;
        insertedGroups++;
      }

      // Add matching contacts to the group
      const matchingContacts = SEED_CONTACTS.filter((c) =>
        c.tags.some((t) => g.contactTags.includes(t))
      );

      for (const c of matchingContacts) {
        const contactId = contactIdMap[c.email];
        if (!contactId) continue;

        await (supabase.from("contact_group_members") as any)
          .upsert(
            {
              tenant_id: tenantId,
              group_id: groupId,
              contact_id: contactId,
            },
            { onConflict: "group_id,contact_id", ignoreDuplicates: true }
          );
      }
    }

    return { ok: true, contacts: insertedContacts, groups: insertedGroups };
  } catch (err: unknown) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
