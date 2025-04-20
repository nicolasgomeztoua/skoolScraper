import puppeteer, { Browser, Page } from 'puppeteer';
import { CommunityPost } from '../types';
import { SKOOL_EMAIL, SKOOL_PASSWORD } from '../config';

// CSS Selectors (Updated based on inspection)
const SELECTORS = {
  // Using partial class matching based on inspection
  postContainer: 'div[class*="PostItemCardContent-"]',
  authorName: 'span[class*="UserNameText-"] span', // Target inner span for text
  timestamp: 'div[class*="PostTimeContent-"]',
  content: 'div[class*="ContentPreviewWrapper-"]',
  // Base selector for the link element, href needs dynamic community slug
  // We look for an anchor tag starting with the community slug, having a specific class prefix,
  // and containing the title wrapper div to distinguish it from other links.
  postLinkSelectorTemplate: 'a[href^="/{COMMUNITY_SLUG}/"][class*="ChildrenLink-"]:has(div[class*="TitleWrapper"])',
  // Selector for the feed container itself (verify this on the page, might need adjustment)
  feedContainer: 'div[role="list"]', // Example, a common pattern for lists
};

export class SkoolScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private communityUrl: string | null = null; // Store communityUrl for context

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
    
    this.communityUrl = communityUrl; // Store for later use
    console.log(`Navigating to community: ${communityUrl}`);
    try {
      await this.page.goto(communityUrl, { waitUntil: 'networkidle0', timeout: 60000 });
      // Wait for the *new* post container selector to ensure the main feed has loaded
      await this.page.waitForSelector(SELECTORS.postContainer, { timeout: 30000 });
      console.log('Successfully navigated to community and found post containers.');
    } catch (error) {
      console.error(`Error navigating to community ${communityUrl}:`, error);
      // Try taking a screenshot for debugging
      try {
        await this.page.screenshot({ path: 'error_navigate_community.png', fullPage: true });
        console.log('Screenshot saved as error_navigate_community.png');
      } catch (screenshotError) {
        console.error('Failed to take screenshot:', screenshotError);
      }
      throw new Error(`Failed to navigate to community page or find initial posts: ${communityUrl}. Timeout or selector error.`);
    }
  }

  async scrapePosts(limit: number = 20): Promise<CommunityPost[]> {
    if (!this.page || !this.communityUrl) throw new Error('Browser not initialized or community URL not set');
    const communityUrl = this.communityUrl;

    console.log(`Scraping posts from ${communityUrl}, limit: ${limit}`);
    const scrapedPosts: CommunityPost[] = [];
    const processedPostIds = new Set<string>();
    let lastHeight = await this.page.evaluate('document.body.scrollHeight');
    const communityName = communityUrl.split('/').pop() || '';

    const postLinkSelector = `${SELECTORS.postLinkSelectorTemplate.replace('{COMMUNITY_SLUG}', communityName)}`;

    while (scrapedPosts.length < limit) {
      console.log(`Current post count: ${scrapedPosts.length}. Checking for new posts...`);
      const postElements = await this.page.$$(SELECTORS.postContainer);
      console.log(`Found ${postElements.length} post elements on the page.`);

      let postsAddedInThisScroll = 0;

      for (const postElement of postElements) {
        let postId: string | null = null; // Initialize postId for error logging
        try {
          const linkElement = await postElement.$(postLinkSelector);
          // Use type assertion within evaluate for href
          const link = linkElement ? await linkElement.evaluate((el: Element) => (el as HTMLAnchorElement).href) : null;

          if (!link || processedPostIds.has(link)) {
            continue;
          }

          postId = link; // Assign after check

          const authorElement = await postElement.$(SELECTORS.authorName);
          // Use type assertion within evaluate for textContent
          const authorName = authorElement ? await authorElement.evaluate((el: Element) => (el as HTMLElement).textContent?.trim()) : 'Unknown Author';

          const timeElement = await postElement.$(SELECTORS.timestamp);
          // Use type assertion within evaluate for textContent
          const rawTimestamp = timeElement ? await timeElement.evaluate((el: Element) => (el as HTMLElement).textContent?.trim()) : 'Unknown Time';
          const timestamp = rawTimestamp?.replace(/•.*$/, '').trim() || 'Unknown Time';

          const contentElement = await postElement.$(SELECTORS.content);
          // Use type assertion within evaluate for textContent
          const content = contentElement ? await contentElement.evaluate((el: Element) => (el as HTMLElement).textContent?.trim()) : '';

          scrapedPosts.push({
            id: postId,
            communityUrl: communityUrl,
            author: authorName || 'Unknown Author',
            timestamp: timestamp || 'Unknown Time',
            content: content || '',
            url: link
          });
          processedPostIds.add(postId);
          postsAddedInThisScroll++;
          // console.log(`Added post: ${postId} (Total: ${scrapedPosts.length})`); // Reduced console noise

          if (scrapedPosts.length >= limit) {
            console.log(`Reached post limit: ${limit}`);
            break;
          }
        } catch (error) {
          console.error(`Error processing a post element (ID: ${postId ?? 'unknown'}):`, error);
        }
      }

      if (scrapedPosts.length >= limit) {
        break;
      }

      // Scroll down
      console.log('Scrolling down to load more posts...');
      await this.page.evaluate('window.scrollTo(0, document.body.scrollHeight)');
      try {
        await this.page.waitForNetworkIdle({ idleTime: 1000, timeout: 5000 });
      } catch (e) {
        console.log('Network idle wait timed out, proceeding with fixed wait.');
        await this.page.waitForTimeout(2000);
      }
      const newHeight = await this.page.evaluate('document.body.scrollHeight');
      if (newHeight === lastHeight && postsAddedInThisScroll === 0) {
        console.log('No new posts loaded after scroll and wait. Assuming end of feed.');
        break;
      }
      lastHeight = newHeight;
      await this.page.waitForTimeout(500);
    }

    console.log(`Finished scraping. Total posts collected: ${scrapedPosts.length}`);
    return scrapedPosts.slice(0, limit);
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }
} 