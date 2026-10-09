import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const missingPackages = [
  {
    id: "toren",
    name: "Günübirlik (Sadece Tören)",
    group: "konaklamasız",
    capacity: 1,
    nights: 0,
    ceremony: true,
    gala: false,
    sort_order: 10,
    early_bird_price: 55,
    round_1_price: 55,
    round_2_price: 55,
  },
  {
    id: "gala",
    name: "Gala",
    group: "konaklamasız",
    capacity: 1,
    nights: 0,
    ceremony: false,
    gala: true,
    sort_order: 11,
    early_bird_price: 75,
    round_1_price: 75,
    round_2_price: 75,
  },
  {
    id: "gala-toren",
    name: "Günübirlik + Gala",
    group: "konaklamasız",
    capacity: 1,
    nights: 0,
    ceremony: true,
    gala: true,
    sort_order: 12,
    early_bird_price: 130,
    round_1_price: 130,
    round_2_price: 130,
  },
];

async function main() {
  console.log("Updating / inserting non-accommodation packages...");

  for (const pkg of missingPackages) {
    const { data: existing } = await admin
      .from("packages")
      .select("id")
      .eq("id", pkg.id)
      .maybeSingle();

    if (existing) {
      console.log(`Updating package ${pkg.id} (${pkg.name})...`);
      const { error } = await admin
        .from("packages")
        .update({
          name: pkg.name,
          group: pkg.group,
          capacity: pkg.capacity,
          nights: pkg.nights,
          ceremony: pkg.ceremony,
          gala: pkg.gala,
          early_bird_price: pkg.early_bird_price,
          round_1_price: pkg.round_1_price,
          round_2_price: pkg.round_2_price,
        })
        .eq("id", pkg.id);

      if (error) {
        console.error(`Failed to update ${pkg.id}:`, error.message);
      } else {
        console.log(`Successfully updated ${pkg.id}`);
      }
    } else {
      console.log(`Inserting package ${pkg.id} (${pkg.name})...`);
      const { error } = await admin.from("packages").insert(pkg);
      if (error) {
        console.error(`Failed to insert ${pkg.id}:`, error.message);
      } else {
        console.log(`Successfully inserted ${pkg.id}`);
      }
    }
  }

  // Verify
  const { data, error } = await admin
    .from("packages")
    .select("id, name, group, early_bird_price, round_1_price, round_2_price")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("Failed to fetch packages:", error.message);
  } else {
    console.log("\nAll packages after update:");
    console.table(data);
  }
}

main();
