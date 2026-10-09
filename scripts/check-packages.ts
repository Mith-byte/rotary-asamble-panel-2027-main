import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

async function main() {
  const { data, error } = await admin.from("packages").select("*").order("sort_order", { ascending: true });
  if (error) {
    console.error("Error fetching packages:", error);
    return;
  }
  console.log("Current packages in database:");
  console.table(data);
}

main();
