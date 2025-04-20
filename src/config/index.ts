import { env } from '../env'; // Import the validated environment variables

// Skool credentials
export const SKOOL_EMAIL = env.SKOOL_EMAIL;
export const SKOOL_PASSWORD = env.SKOOL_PASSWORD;

// Community URLs - Process the validated string into an array
export const SKOOL_COMMUNITY_URLS: string[] = env.SKOOL_COMMUNITY_URLS
  .split(',')
  .map(url => url.trim())
  .filter(url => url.length > 0);

// API Keys
export const GEMINI_API_KEY = env.GEMINI_API_KEY;

// SheetDB API Endpoint
export const SHEETDB_API_ENDPOINT = env.SHEETDB_API_ENDPOINT;
export const SHEETDB_AUTH_TOKEN = env.SHEETDB_AUTH_TOKEN;

// Removed Google Sheet related exports

// The old validateConfig function is no longer needed as validation happens in env.ts 