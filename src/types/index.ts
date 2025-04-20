export interface CommunityPost {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  communityUrl: string;
  url: string;
}

export interface ProcessedPost {
  sheetId: string;
  problemIdentified: string;
  originalContent: string;
  suggestedSolution?: string;
  tags?: string[];
  category?: string;
  authorName?: string;
  postTimestamp?: string;
  postUrl?: string;
  communityUrl?: string;
}

export interface SkoolConfig {
  email: string;
  password: string;
  communityUrl: string;
}

export interface SheetData {
  id: string;
  problem: string;
  originalContent: string;
  suggestedSolution?: string;
  tags?: string;
  category?: string;
  status?: string;
  timestamp: string;
  authorName?: string;
  postTimestamp?: string;
  postUrl?: string;
  communityUrl?: string;
} 