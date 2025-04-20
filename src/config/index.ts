import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Skool credentials
export const SKOOL_EMAIL = process.env.SKOOL_EMAIL || '';
export const SKOOL_PASSWORD = process.env.SKOOL_PASSWORD || '';

// Community URLs (comma-separated)
const rawCommunityUrls = process.env.SKOOL_COMMUNITY_URLS || '';
export const SKOOL_COMMUNITY_URLS: string[] = rawCommunityUrls
  .split(',')
  .map(url => url.trim())
  .filter(url => url.length > 0);

// Other configs
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
export const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
export const GOOGLE_CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS || '';

// Validate required environment variables
export const validateConfig = (): void => {
  const requiredVars = [
    { name: 'SKOOL_EMAIL', value: SKOOL_EMAIL },
    { name: 'SKOOL_PASSWORD', value: SKOOL_PASSWORD },
    { name: 'SKOOL_COMMUNITY_URLS', value: rawCommunityUrls }, // Check the raw string
    { name: 'GEMINI_API_KEY', value: GEMINI_API_KEY },
    { name: 'GOOGLE_SHEET_ID', value: GOOGLE_SHEET_ID },
    { name: 'GOOGLE_APPLICATION_CREDENTIALS', value: GOOGLE_CREDENTIALS_PATH },
  ];

  const missingVars = requiredVars.filter(v => !v.value);

  if (missingVars.length > 0) {
    const missingVarNames = missingVars.map(v => v.name).join(', ');
    throw new Error(`Missing required environment variables: ${missingVarNames}`);
  }
  
  if (SKOOL_COMMUNITY_URLS.length === 0) {
    throw new Error('SKOOL_COMMUNITY_URLS must contain at least one valid URL.');
  }
}; 