import dotenv from "dotenv";

dotenv.config();

type EnvConfig = {
  port: number;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  botApiSecret?: string;
  enforceTwilioSignature: boolean;
};

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set.`);
  }
  return value;
}

// If SUPABASE integration is disabled (development), don't require supabase envs
const supabaseDisabled = process.env.DISABLE_SUPABASE === "true";

export const env: EnvConfig = {
  port: Number(process.env.PORT || 3000),
  supabaseUrl: supabaseDisabled ? undefined : process.env.SUPABASE_URL || undefined,
  supabaseServiceRoleKey: supabaseDisabled ? undefined : process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
  botApiSecret: process.env.BOT_API_SECRET || undefined,
  enforceTwilioSignature: process.env.ENFORCE_TWILIO_SIGNATURE === "true"
};
