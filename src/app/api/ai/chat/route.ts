import { auth, currentUser } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { classifyQuery, validateResponse, OFF_TOPIC_RESPONSE } from "@/lib/ai/guardrails";
import { buildSystemPrompt, buildEnrichedPrompt } from "@/lib/ai/system-prompt";
import { searchKnowledge } from "@/lib/ai/knowledge-search";
import {
  getUserContext,
  getPageContext,
  getClientName,
  getUserMemories,
} from "@/lib/ai/context";
import { TOOL_DEFINITIONS, executeAction } from "@/lib/ai/actions";
import { db } from "@/lib/db";
import { aiConversations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { ChatRequest } from "@/lib/ai/types";

const MAX_TOOL_ROUNDS = 5;

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey });
}

export async function POST(request: Request) {
  const { userId, orgId, orgSlug } = await auth();
  if (!userId || !orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`ai-chat:${userId}`, RATE_LIMITS.aiChat);
  if (!rl.success) {
    return NextResponse.json(
      { error: "For mange forespørsler. Vent litt før du prøver igjen." },
      { status: 429 }
    );
  }

  let body: ChatRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { messages, conversationId, pageContext: pagePath } = body;
  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "No messages" }, { status: 400 });
  }

  const lastUserMessage = messages[messages.length - 1];
  if (lastUserMessage.role !== "user" || !lastUserMessage.content.trim()) {
    return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
  }

  const classification = classifyQuery(lastUserMessage.content);
  if (!classification.onTopic && classification.confidence > 0.8) {
    return streamTextResponse(OFF_TOPIC_RESPONSE, conversationId);
  }

  try {
    const user = await currentUser();
    const userCtx = await getUserContext(
      userId,
      orgId,
      user?.firstName ?? undefined,
      orgSlug ?? undefined
    );
    const pageCtx = pagePath ? getPageContext(pagePath) : null;

    if (pageCtx?.clientId) {
      const name = await getClientName(pageCtx.clientId, orgId);
      if (name) pageCtx.clientName = name;
    }

    const mode = userCtx.onboardingCompleted ? "support" : "onboarding";
    const basePrompt = buildSystemPrompt(userCtx, pageCtx, mode);

    const [knowledgeResults, memories] = await Promise.all([
      searchKnowledge(lastUserMessage.content).catch(() => []),
      getUserMemories(userId, orgId).catch(() => []),
    ]);

    const systemPrompt = buildEnrichedPrompt(basePrompt, knowledgeResults, memories);

    const anthropic = getAnthropicClient();
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.content,
    }));

    let finalText = "";
    const toolsUsed: string[] = [];
    let totalTokens = 0;

    let currentMessages = [...anthropicMessages];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: currentMessages,
        tools: TOOL_DEFINITIONS,
      });

      totalTokens += (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === "text"
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );

      if (textBlocks.length > 0) {
        finalText += textBlocks.map((b) => b.text).join("");
      }

      if (toolUseBlocks.length === 0 || response.stop_reason !== "tool_use") {
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUseBlocks) {
        toolsUsed.push(toolUse.name);
        const result = await executeAction(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          orgId
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: response.content },
        { role: "user", content: toolResults },
      ];
    }

    const guardrail = validateResponse(finalText, classification.category);
    const responseText = guardrail.filteredResponse;

    const convId = await saveConversation(
      conversationId ?? null,
      userId,
      orgId,
      messages.map((m) => ({ role: m.role, content: m.content })),
      responseText,
      mode,
      pagePath ?? null,
      toolsUsed,
      totalTokens
    );

    return streamTextResponse(responseText, convId);
  } catch (err) {
    console.error("[AI Chat] Error:", err);
    return NextResponse.json(
      { error: "Noe gikk galt. Prøv igjen senere." },
      { status: 500 }
    );
  }
}

function streamTextResponse(text: string, conversationId?: string | null) {
  const payload = JSON.stringify({
    content: text,
    conversationId: conversationId ?? null,
  });

  return new Response(payload, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

async function saveConversation(
  existingId: string | null,
  userId: string,
  orgId: string,
  userMessages: Array<{ role: string; content: string }>,
  assistantResponse: string,
  mode: "support" | "onboarding",
  pageContext: string | null,
  toolsUsed: string[],
  tokensUsed: number
): Promise<string> {
  const allMessages = [
    ...userMessages,
    { role: "assistant", content: assistantResponse },
  ];

  if (existingId) {
    await db
      .update(aiConversations)
      .set({
        messages: allMessages,
        toolsUsed,
        tokensUsed,
      })
      .where(eq(aiConversations.id, existingId));
    return existingId;
  }

  const [row] = await db
    .insert(aiConversations)
    .values({
      userId,
      organizationId: orgId,
      messages: allMessages,
      mode,
      pageContext,
      toolsUsed,
      tokensUsed,
    })
    .returning({ id: aiConversations.id });

  return row.id;
}
