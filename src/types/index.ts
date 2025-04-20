export interface CommunityPost {
  id: string;
  content: string;
  author: string;
  timestamp: string;
  url?: string;
}

export interface ProcessedPost {
  id: string;
  originalContent: string;
  problemIdentified: string;
  potentialSolution?: string;
  tags?: string[];
  category?: string;
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
} 