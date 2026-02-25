import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

async function main() {
  // Load env from repo root and tenant app (service role key lives there in this repo).
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
  const bucket = "support-tickets";

  const logoFilePath =
    process.argv[2] ||
    process.env.LOGO_PATH ||
    "";
  if (!logoFilePath) {
    throw new Error(
      "Logo file path missing. Usage: `corepack pnpm -s tsx scripts/set-pet-store-direct-logo.ts <path/to/logo.png>` " +
        "or set LOGO_PATH env var."
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const tenantRes = await supabase
    .from("tenants")
    .select("id,name,branding")
    .ilike("name", tenantName)
    .limit(2);

  if (tenantRes.error) throw tenantRes.error;

  const tenants = tenantRes.data ?? [];
  if (tenants.length === 0) {
    throw new Error(`Tenant not found by name: ${tenantName}`);
  }
  if (tenants.length > 1) {
    throw new Error(
      `Multiple tenants matched name "${tenantName}". Please make the name unique or update the script to target by id/domain.`
    );
  }

  const tenant = tenants[0] as {
    id: string;
    name: string;
    branding: Record<string, unknown> | null;
  };

  // If logo already set, don't re-upload (avoid creating many objects).
  const existingLogo = (tenant.branding as any)?.logo;
  if (typeof existingLogo === "string" && existingLogo.length > 0) {
    console.log(`Tenant "${tenant.name}" already has branding.logo set. Skipping upload.`);
    return;
  }

  const bytes = await fs.readFile(logoFilePath);
  const objectPath = `${tenant.id}/branding/logo-${Date.now()}.png`;

  const uploadRes = await supabase.storage
    .from(bucket)
    .upload(objectPath, bytes, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadRes.error) throw uploadRes.error;

  // Use a long-lived signed URL for immediate use in the UI.
  // If your project enforces a max TTL, this will be capped server-side.
  const oneYearSeconds = 60 * 60 * 24 * 365;
  const signedRes = await supabase.storage
    .from(bucket)
    .createSignedUrl(objectPath, oneYearSeconds);

  if (signedRes.error) throw signedRes.error;

  const logoUrl = signedRes.data?.signedUrl;
  if (!logoUrl) throw new Error("Failed to generate signed URL for uploaded logo.");

  const nextBranding = {
    ...(tenant.branding ?? {}),
    companyName: tenantName,
    logo: logoUrl,
  };

  const updateRes = await supabase
    .from("tenants")
    .update({ branding: nextBranding })
    .eq("id", tenant.id);

  if (updateRes.error) throw updateRes.error;

  // Sanity-check: ensure branding has a logo set (don't print URL).
  const verifyRes = await supabase
    .from("tenants")
    .select("id,name,branding")
    .eq("id", tenant.id)
    .single();
  if (verifyRes.error) throw verifyRes.error;
  const branding = (verifyRes.data as any)?.branding as Record<string, unknown> | null;

  // Keep output minimal (no secrets).
  console.log(
    `Updated tenant "${tenant.name}" branding.logo to uploaded PSD logo. (logo_set=${Boolean(
      branding && typeof branding.logo === "string" && branding.logo.length > 0
    )})`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

