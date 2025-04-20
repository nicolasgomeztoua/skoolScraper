# Community Scraper

A tool to scrape Skool.com community posts, process them with Gemini AI to extract problems and insights, and store results in Google Sheets for further analysis.

## Project Overview

This project helps you gather community problems from Skool.com communities so you can later create solution-based content. It:

1. Logs into your Skool.com account
2. Scrapes posts from a specified community
3. Uses Gemini AI to identify problems discussed in each post
4. Saves the structured data to a Google Sheet

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- npm or yarn
- A Skool.com account with access to the community you want to scrape
- Google Cloud account for Sheets API
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

### Google Sheets Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Sheets API
4. Create a service account with appropriate permissions
5. Download the JSON credentials file
6. Create a new Google Sheet and share it with the service account email
7. Copy the Sheet ID from the URL and add it to your `.env` file

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
  - `services/` - Core functionality
    - `skoolScraper.ts` - Handles scraping from Skool.com
    - `geminiService.ts` - Processes posts with Gemini AI
    - `googleSheetsService.ts` - Saves data to Google Sheets
  - `types/` - TypeScript type definitions
  - `index.ts` - Main entry point

## Customization

- Adjust the `POST_LIMIT` in `src/index.ts` to control how many posts are scraped
- Modify the Gemini AI prompt in `src/services/geminiService.ts` to extract different information
- Update the Google Sheet structure in `src/services/googleSheetsService.ts` to match your data needs

## Notes

- The selectors in the scraper may need adjustments as Skool.com updates their site
- Be mindful of Skool.com's terms of service when scraping
- Consider adding a longer delay between requests to avoid rate limiting 