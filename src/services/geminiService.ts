import { GoogleGenerativeAI } from '@google/generative-ai';
import { CommunityPost, ProcessedPost } from '../types';
import { GEMINI_API_KEY } from '../config';

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
  }

  async processPost(post: CommunityPost): Promise<ProcessedPost> {
    try {
      const prompt = `
        Analyze the following community post and extract the problem being discussed.
        The post typically follows a format where someone is asking for help or describing an issue they're facing.
        
        Post Content:
        "${post.content}"
        
        Extract the following information:
        1. What specific problem or pain point is being described? (Be concise)
        2. What category would this problem fall under? (e.g., Marketing, Tech, Business Operations, etc.)
        3. What relevant tags would you assign to this post? (Provide 3-5 tags separated by commas)
        4. Is there any potential solution suggested in the post? If yes, briefly describe it.
        
        Format your response as JSON with the following structure:
        {
          "problemIdentified": "The extracted problem statement",
          "category": "The relevant category",
          "tags": ["tag1", "tag2", "tag3"],
          "potentialSolution": "Brief description of any solution mentioned or null if none is provided"
        }
      `;

      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract JSON from response
      const jsonStr = responseText.match(/\{[\s\S]*\}/)?.[0] || '{}';
      const parsedResponse = JSON.parse(jsonStr);
      
      return {
        id: post.id,
        originalContent: post.content,
        problemIdentified: parsedResponse.problemIdentified || 'No problem identified',
        potentialSolution: parsedResponse.potentialSolution || undefined,
        tags: parsedResponse.tags || [],
        category: parsedResponse.category || undefined,
      };
    } catch (error) {
      console.error('Error processing post with Gemini AI:', error);
      return {
        id: post.id,
        originalContent: post.content,
        problemIdentified: 'Error processing with AI',
      };
    }
  }

  async processBatch(posts: CommunityPost[]): Promise<ProcessedPost[]> {
    const processedPosts: ProcessedPost[] = [];
    
    for (const post of posts) {
      try {
        const processedPost = await this.processPost(post);
        processedPosts.push(processedPost);
        
        // Add a short delay between API calls to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error);
        processedPosts.push({
          id: post.id,
          originalContent: post.content,
          problemIdentified: 'Error processing with AI',
        });
      }
    }
    
    return processedPosts;
  }
} 