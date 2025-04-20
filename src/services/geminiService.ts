import { GoogleGenAI } from "@google/genai";
import { CommunityPost, ProcessedPost } from "../types";
import { GEMINI_API_KEY } from "../config";

export class GeminiService {
  private genAI: GoogleGenAI;

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }


  async processPost(post: CommunityPost): Promise<ProcessedPost> {
    const modelIdentifier = "gemini-2.5-pro-preview-03-25";

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

      const result = await this.genAI.models.generateContent({
          model: modelIdentifier,
          contents: prompt
      });
      
      const response = result;
      const responseText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      const jsonStr = responseText.match(/\{[\s\S]*\}/)?.[0] || "{}";
      const parsedResponse = JSON.parse(jsonStr);

      return {
        sheetId: post.id,
        originalContent: post.content,
        problemIdentified:
          parsedResponse.problemIdentified || "No problem identified",
        suggestedSolution: parsedResponse.potentialSolution || undefined,
        tags: parsedResponse.tags || [],
        category: parsedResponse.category || undefined,
        authorName: post.author,
        postTimestamp: post.timestamp,
        postUrl: post.url,
        communityUrl: post.communityUrl,
      };
    } catch (error) {
      console.error(`Error processing post with Gemini AI (Model: ${modelIdentifier}):`, error);
      return {
        sheetId: post.id,
        originalContent: post.content,
        problemIdentified: "Error processing with AI",
        authorName: post.author,
        postTimestamp: post.timestamp,
        postUrl: post.url,
        communityUrl: post.communityUrl,
      };
    }
  }

  async processBatch(posts: CommunityPost[]): Promise<ProcessedPost[]> {
    const processedPosts: ProcessedPost[] = [];

    for (const post of posts) {
      try {
        const processedPost = await this.processPost(post);
        processedPosts.push(processedPost);

        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to process batch item for post ${post.id}. See previous error.`);
        processedPosts.push({
          sheetId: post.id,
          originalContent: post.content,
          problemIdentified: "Error processing batch item",
          authorName: post.author,
          postTimestamp: post.timestamp,
          postUrl: post.url,
          communityUrl: post.communityUrl,
        });
      }
    }

    return processedPosts;
  }
}
