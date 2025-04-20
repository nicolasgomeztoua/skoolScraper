import puppeteer, { Browser, Page } from 'puppeteer';
import { CommunityPost } from '../types';
import { SKOOL_EMAIL, SKOOL_PASSWORD } from '../config';

export class SkoolScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await this.browser.newPage();
    
    // Set viewport
    await this.page.setViewport({ width: 1280, height: 800 });
    
    // Set user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'
    );
  }

  async login(): Promise<boolean> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      // Navigate to login page
      await this.page.goto('https://www.skool.com/login', { waitUntil: 'networkidle2' });
      
      // Fill in login form using imported credentials
      await this.page.type('input[type="email"]', SKOOL_EMAIL);
      await this.page.type('input[type="password"]', SKOOL_PASSWORD);
      
      // Click login button and wait for navigation
      await Promise.all([
        this.page.click('button[type="submit"]'),
        this.page.waitForNavigation({ waitUntil: 'networkidle2' }),
      ]);
      
      // Check if login was successful
      const url = this.page.url();
      return !url.includes('/login');
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  async navigateToCommunity(communityUrl: string): Promise<void> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      // Use the provided communityUrl
      await this.page.goto(communityUrl, { waitUntil: 'networkidle2' });
      console.log(`Navigated to: ${communityUrl}`);
      // Wait for community content to load
      await this.page.waitForSelector('.post-card, .feed-item', { timeout: 30000 });
      console.log(`Content loaded for: ${communityUrl}`);
    } catch (error) {
      console.error(`Error navigating to community ${communityUrl}:`, error);
      throw error; // Re-throw error to be handled by the main loop
    }
  }

  async scrapePosts(limit: number = 20): Promise<CommunityPost[]> {
    if (!this.page) throw new Error('Browser not initialized');
    
    try {
      // This selector needs to be adjusted based on Skool's actual DOM structure
      const postSelector = '.post-card, .feed-item'; 
      await this.page.waitForSelector(postSelector);
      
      // Scroll to load more posts if needed
      let currentPostCount = 0;
      while (currentPostCount < limit) {
        const posts = await this.page.$$(postSelector);
        currentPostCount = posts.length;
        
        if (currentPostCount >= limit) break;
        
        // Scroll down to load more posts
        await this.page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Wait for possible new posts to load
        await this.page.waitForTimeout(2000);
        
        // Check if we've loaded new posts
        const newPostCount = (await this.page.$$(postSelector)).length;
        if (newPostCount === currentPostCount) {
          // No new posts loaded, we've reached the end
          break;
        }
      }
      
      // Extract post data
      const posts = await this.page.evaluate((selector: string) => {
        const postElements = Array.from(document.querySelectorAll(selector));
        return postElements.map((post) => {
          // These selectors need to be adjusted based on Skool's actual DOM structure
          const contentEl = post.querySelector('.post-content, .content');
          const authorEl = post.querySelector('.author-name, .username');
          const timestampEl = post.querySelector('.timestamp, .date');
          const idAttr = post.getAttribute('data-post-id') || post.getAttribute('id');
          const urlEl = post.querySelector('a.post-link') as HTMLAnchorElement;
          
          return {
            id: idAttr || String(Math.random()),
            content: contentEl ? contentEl.textContent?.trim() || '' : '',
            author: authorEl ? authorEl.textContent?.trim() || '' : '',
            timestamp: timestampEl ? timestampEl.textContent?.trim() || '' : '',
            url: urlEl ? urlEl.href : undefined,
          };
        });
      }, postSelector);
      
      return posts.slice(0, limit) as CommunityPost[];
    } catch (error) {
      console.error('Error scraping posts:', error);
      return [];
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
} 