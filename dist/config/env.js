"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
function requireEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Environment variable ${name} is required but not set.`);
    }
    return value;
}
// If SUPABASE integration is disabled (development), don't require supabase envs
const supabaseDisabled = process.env.DISABLE_SUPABASE === "true";
exports.env = {
    port: Number(process.env.PORT || 3000),
    supabaseUrl: supabaseDisabled ? undefined : process.env.SUPABASE_URL || undefined,
    supabaseServiceRoleKey: supabaseDisabled ? undefined : process.env.SUPABASE_SERVICE_ROLE_KEY || undefined,
    botApiSecret: process.env.BOT_API_SECRET || undefined,
    enforceTwilioSignature: process.env.ENFORCE_TWILIO_SIGNATURE === "true"
};
