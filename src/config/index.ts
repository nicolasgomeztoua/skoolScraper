import { env } from '../env'; // Import the validated environment variables

// Skool credentials
export const SKOOL_EMAIL = env.SKOOL_EMAIL;
export const SKOOL_PASSWORD = env.SKOOL_PASSWORD;

// Community URLs - Process the validated string into an array
export const SKOOL_COMMUNITY_URLS: string[] = env.SKOOL_COMMUNITY_URLS
  .split(',')
  .map((url: string) => url.trim())
  .filter((url: string) => url.length > 0);

// API Keys
export const GEMINI_API_KEY = env.GEMINI_API_KEY;
export const API_KEY = env.API_KEY; // Export the generic API key

// Replace SheetDB exports with Apps Script URL export
export const APPS_SCRIPT_WEB_APP_URL = env.APPS_SCRIPT_WEB_APP_URL;
