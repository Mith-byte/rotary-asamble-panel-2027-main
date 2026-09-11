import { createClient } from "./server";

/**
 * Create a Supabase client with automatic retry on auth errors
 * Helps handle concurrent token refresh issues
 */
export async function createClientWithRetry(maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const supabase = await createClient();
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error) {
        // If it's a refresh token error and we have retries left, wait and retry
        if (error.message?.includes("refresh_token") && attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt))); // Exponential backoff
          continue;
        }
        throw error;
      }

      return { supabase, user };
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
    }
  }

  throw new Error("Failed to create authenticated client after retries");
}
