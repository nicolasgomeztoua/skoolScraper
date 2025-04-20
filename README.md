# Community Scraper

A tool to scrape Skool.com community posts, process them with Gemini AI to extract problems and insights, and store results in Google Sheets via SheetDB for further analysis.

## Project Overview

This project helps you gather community problems from Skool.com communities so you can later create solution-based content. It:

1. Logs into your Skool.com account
2. Scrapes posts from specified communities
3. Uses Gemini AI to identify problems discussed in each post
4. Saves the structured data to a Google Sheet using the SheetDB service

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- npm or yarn
- A Skool.com account with access to the community you want to scrape
- A Google Sheet to store the data
- A SheetDB account ([SheetDB.io](https://sheetdb.io/)) 
- Gemini AI API key

### Installation

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```
   cp .env.example .env
   ```
4. Fill in your credentials in the `.env` file

### SheetDB Setup

1. Create a Google Sheet with the desired headers in the first row. Example headers:
   `id`, `problem`, `originalContent`, `suggestedSolution`, `tags`, `category`, `status`, `timestamp`
2. Go to [SheetDB.io](https://sheetdb.io/) and sign up or log in.
3. Click "Create API" and paste the URL of your Google Sheet.
4. Follow the instructions to connect your sheet.
5. SheetDB will provide you with an API endpoint URL.
6. **(Recommended Security)** In your SheetDB API settings, go to the "Authentication" section.
   - Select "Token" (or "Bearer Token") authentication.
   - SheetDB will generate a token. Copy this token.
7. Copy the API endpoint URL and the Authentication Token (if generated).
8. Paste the URL into your `.env` file as the value for `SHEETDB_API_ENDPOINT`.
9. Paste the Token into your `.env` file as the value for `SHEETDB_AUTH_TOKEN`.

## Usage

Run the scraper:

```
npm start
```

For development with auto-restart:

```
npm run dev
```

## Project Structure

- `src/`
  - `config/` - Configuration handling
  - `env.ts` - Environment variable validation (Zod)
  - `services/` - Core functionality
    - `skoolScraper.ts` - Handles scraping from Skool.com
    - `geminiService.ts` - Processes posts with Gemini AI
    - `sheetDbService.ts` - Saves data to Google Sheets via SheetDB
  - `types/` - TypeScript type definitions
  - `index.ts` - Main entry point

## Customization

- Adjust the `POST_LIMIT_PER_COMMUNITY` in `src/index.ts` to control how many posts are scraped per community.
- Modify the Gemini AI prompt in `src/services/geminiService.ts` to extract different information.
- Ensure the headers in your Google Sheet match the keys used in `src/services/sheetDbService.ts` (`mapPostToSheetRow` function).

## Notes

- The selectors in the scraper may need adjustments as Skool.com updates their site.
- Be mindful of Skool.com's terms of service when scraping.
- Consider adding a longer delay between requests to avoid rate limiting on Skool or Gemini.
- Be aware of SheetDB's API limits, especially on the free tier. 