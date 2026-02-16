#!/usr/bin/env node
/**
 * Test locality search - query DB for "chi"
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../apps/tenant/.env.local") });
config({ path: resolve(__dirname, "../.env.local"), override: false });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(url, key);

const { data, error } = await supabase
  .from("telnyx_localities")
  .select("locality, phone_number_type")
  .eq("country_code", "US")
  .in("phone_number_type", ["local", "toll_free"])
  .ilike("locality", "chi%")
  .order("locality")
  .limit(25);

if (error) {
  console.error("Error:", error);
  process.exit(1);
}

console.log("chi results:", data?.length ?? 0);
data?.forEach((r) => console.log(" -", r.locality, r.phone_number_type));

const { data: allC } = await supabase
  .from("telnyx_localities")
  .select("locality, phone_number_type")
  .eq("country_code", "US")
  .ilike("locality", "c%")
  .order("locality")
  .limit(50);
console.log("\nAll US localities starting with c:", allC?.length ?? 0);
allC?.forEach((r) => console.log(" -", r.locality, r.phone_number_type));

const { data: chicago } = await supabase
  .from("telnyx_localities")
  .select("locality")
  .ilike("locality", "%chicago%");
console.log("\nChicago search:", chicago?.length ?? 0, chicago);
