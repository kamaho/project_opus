export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolResults?: ToolResult[];
  timestamp?: string;
}

export interface ToolResult {
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
}

export interface ConversationMeta {
  id: string;
  mode: "support" | "onboarding";
  pageContext: string | null;
  toolsUsed: string[];
  tokensUsed: number;
}

export interface SearchResult {
  id: string;
  type: "article" | "snippet" | "faq" | "guide";
  title: string;
  content: string;
  summary?: string | null;
  category?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  similarity?: number;
  priority?: number;
}

export interface UserContext {
  userId: string;
  orgId: string;
  orgName?: string;
  userName?: string;
  role?: string;
  clientCount: number;
  onboardingCompleted: boolean;
}

export interface PageContext {
  path: string;
  section: string;
  clientId?: string;
  clientName?: string;
}

export type QueryCategory =
  | "product"
  | "deadline"
  | "client_data"
  | "tax_rule"
  | "off_topic";

export interface QueryClassification {
  onTopic: boolean;
  category: QueryCategory;
  confidence: number;
}

export interface GuardrailResult {
  safe: boolean;
  filteredResponse: string;
  warnings: string[];
}

export interface ChatRequest {
  messages: ChatMessage[];
  conversationId?: string;
  pageContext?: string;
}
