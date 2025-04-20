import { GoogleGenAI } from "@google/genai";
import { CommunityPost, ProcessedPost } from "../types";
import { GEMINI_API_KEY } from "../config";

export class GeminiService {
  private genAI: GoogleGenAI;

  constructor() {
    this.genAI = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  }


  async processPost(post: CommunityPost): Promise<ProcessedPost> {
    const modelIdentifier = "gemini-2.5-flash-preview-04-17";

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

  // Method to select a post ID for generation using AI evaluation
  async selectPostForGeneration(unprocessedPostsData: any[][]): Promise<string | null> {
    console.log(`AI evaluating ${unprocessedPostsData.length} unprocessed posts for generation suitability...`);
    if (unprocessedPostsData.length === 0) {
      return null;
    }

    // Prepare concise data for the prompt
    const postSummaries = unprocessedPostsData.map(row => ({
      id: row[0], // Assuming ID is column 0
      problem: row[1] || 'Unknown Problem', // Assuming problem is column 1
      contentSnippet: (row[2] || '').substring(0, 200) + '...' // Assuming content is column 2
    }));

    // Limit the number of summaries sent to avoid large prompts (e.g., first 20)
    const summariesToSend = postSummaries.slice(0, 20);
    const originalIds = new Set(summariesToSend.map(s => s.id)); // Keep track of IDs sent

    const modelIdentifier = "gemini-2.5-pro-preview-03-25"; // Use a capable model for selection

    try {
      const prompt = `
        You are an AI assistant evaluating community posts to see if a helpful, solution-oriented post can be generated based on them.
        The target format for the generated post is:
        """
        Hi all—I've been struggling with [problem] and I know a lot of people here have been too.
        I spent some time working through it last week, and here's a simple way I solved it [...]:
        1. [Step 1/Insight].
        2. [Step 2/Insight].
        3. [Step 3/Thought].
        If anything is unclear, let me know. Hope this helps you 🙏
        """

        Analyze the following post summaries. Identify the *single best* candidate post from which you could realistically generate a helpful post following the target format. A good candidate is one where a problem is clearly stated, and either a simple solution is hinted at in the original content, OR the problem itself is common enough that a general helpful perspective or insight could be offered.

        If you find a suitable candidate, return ONLY its corresponding 'id'.
        If NONE of the posts seem suitable for generating a helpful post in the target format (e.g., they are too complex, unclear, lack potential for a simple solution/insight), return the exact string "NONE".

        Post Summaries:
        ${JSON.stringify(summariesToSend, null, 2)}

        Return only the selected 'id' or the string "NONE".
      `;

      const result = await this.genAI.models.generateContent({
          model: modelIdentifier,
          contents: prompt,
          // Optional: Add safety settings or generation config if needed
      });

      const response = result;
      const selectedIdRaw = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? null;

      if (selectedIdRaw && selectedIdRaw !== "NONE") {
        // Validate that the returned ID was actually one of the IDs we sent
        if (originalIds.has(selectedIdRaw)) {
            console.log(`AI selected post ID for generation: ${selectedIdRaw}`);
            return selectedIdRaw;
        } else {
            console.warn(`AI returned an ID (${selectedIdRaw}) that was not in the provided list of candidates.`);
            return null;
        }
      } else if (selectedIdRaw === "NONE") {
        console.log('AI determined no suitable posts for generation based on the criteria.');
        return null;
      } else {
        console.warn('AI selection did not return a valid ID or "NONE". Response:', selectedIdRaw);
        return null;
      }

    } catch (error) {
      console.error(`Error during AI post selection (Model: ${modelIdentifier}):`, error);
      return null; // Return null on error
    }
  }

  // Method to generate a new Skool post based on an original post's data row
  async generatePostFromSource(sourcePostData: any[]): Promise<string | null> {
    // Assuming standard REQUIRED_HEADERS order: id=0, problem=1, originalContent=2, suggestedSolution=3, ...
    const originalProblem = sourcePostData[1] || 'a problem mentioned previously';
    const originalContent = sourcePostData[2] || '';
    const originalSolution = sourcePostData[3] || '';
    const modelIdentifier = "gemini-2.5-pro-preview-03-25"; // Use capable model

    console.log(`Generating post content based on original problem: "${originalProblem}"`);

    try {
        // Craft prompt based on user template
        const prompt = `
          Generate a helpful Skool community post based on the following original post discussion.
          The goal is to share a potential solution or perspective in a concise, helpful way, like the example template.
          
          Original Post Problem: "${originalProblem}"
          Original Post Content Snippet (for context): "${originalContent.substring(0, 500)}..." 
          ${originalSolution ? `Original Post Suggested Solution: "${originalSolution}"` : ''}
          
          Use this template structure:
          
          Hi all—I've been struggling with [problem] and I know a lot of people here have been too.
          
          I spent some time working through it last week, and here's a simple way I solved it [mention cost/effort if applicable, e.g., "for less than $10/m" or "with a simple tweak"]:
          
          1. [Step 1 or Key Insight].
          2. [Step 2 or Another Insight].
          3. [Step 3 or Concluding thought].
          
          If anything is unclear, let me know. Hope this helps you 🙏
          
          ---
          
          Generate ONLY the text content for the new post based on the information above. Be concise and helpful. If the original post didn't offer a clear solution, offer a helpful perspective or ask an engaging question related to the problem instead of listing steps. Do not include the "Original Post..." lines in the output.
        `;

        const result = await this.genAI.models.generateContent({
            model: modelIdentifier,
            contents: prompt
            // Add generationConfig here if needed (temperature, etc.)
        });

        const response = result;
        const generatedText = response.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

        if (generatedText) {
            console.log("Successfully generated post content.");
            return generatedText.trim();
        } else {
            console.warn("Gemini did not return valid generated text.");
            return null;
        }

    } catch (error) {
      console.error(`Error generating post content with Gemini AI (Model: ${modelIdentifier}):`, error);
      return null;
    }
  }
}
