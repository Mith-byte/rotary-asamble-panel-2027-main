import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

const ADMIN_EMAILS = ["andyanday33@gmail.com", "hello@cosmonova.studio"];

async function main() {
  for (const email of ADMIN_EMAILS) {
    console.log(`\nProcessing admin: ${email}`);
    
    // Delete old admin user if exists
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (existing) {
      console.log("Deleting old user:", existing.id);
      await admin.auth.admin.deleteUser(existing.id);
    }

    // Create user via Auth Admin API
    const { data, error } = await admin.auth.admin.createUser({
      email: email,
      email_confirm: true,
      user_metadata: { role: "admin" },
    });

    if (error) {
      console.error("Failed to create user:", error.message);
      continue;
    }

    console.log("Created auth user:", data.user.id);

    // Update profile with name
    const { error: updateError } = await admin
      .from("profiles")
      .update({ first_name: "Admin", last_name: "User" })
      .eq("id", data.user.id);

    if (updateError) {
      console.error("Failed to update profile:", updateError.message);
    } else {
      console.log("Profile updated. Admin user ready.");
      console.log("Login with email:", email);
    }
  }
}

main();
