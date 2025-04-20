import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  // Skool Credentials
  SKOOL_EMAIL: z.string().email({ message: "Invalid Skool email address" }),
  SKOOL_PASSWORD: z.string().min(1, { message: "Skool password cannot be empty" }),
  
  // Skool Communities (comma-separated string, will be processed later)
  SKOOL_COMMUNITY_URLS: z.string()
    .min(1, { message: "SKOOL_COMMUNITY_URLS cannot be empty" })
    .refine(urls => urls.split(',').every(url => url.trim().startsWith('https')), {
      message: "All SKOOL_COMMUNITY_URLS must be valid HTTPS URLs",
    }),
  
  // API Keys and IDs
  GEMINI_API_KEY: z.string().min(10, { message: "Invalid Gemini API Key format" }),
  
  // Google Apps Script Web App URL
  APPS_SCRIPT_WEB_APP_URL: z.string().url({ message: "Invalid Apps Script Web App URL" }),
  
  // General API Key for securing endpoints
  API_KEY: z.string().min(10, { message: "API Key seems too short" }),
});

// Validate process.env against the schema
const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error(
    "❌ Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors,
  );
  // Throwing an error terminates the application
  throw new Error("Invalid environment variables.");
}

// Export the validated and typed environment variables
export const env = parsedEnv.data; 