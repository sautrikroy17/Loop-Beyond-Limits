import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// The server client uses the Service Role key to bypass RLS for secure API operations,
// OR you can use SSR auth helpers. We use the service role here for the MVP backend scaffolding.
const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://placeholder-project-url.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key";

export const supabaseServer = createClient<Database>(supabaseUrl, supabaseServiceKey);
