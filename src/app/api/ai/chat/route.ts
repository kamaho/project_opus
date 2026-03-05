import { withTenant } from "@/lib/auth";
import { auth, currentUser } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { classifyQuery, validateResponse, OFF_TOPIC_RESPONSE } from "@/lib/ai/guardrails";
import { buildSystemPrompt, buildEnrichedPrompt } from "@/lib/ai/system-prompt";
import { searchKnowledge } from "@/lib/ai/knowledge-search";
import { z } from "zod";
import { zodError } from "@/lib/api/zod-error";
export const maxDuration = 60;

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
const MAX_API_RETRIES = 2;
const RATE_LIMIT_RETRY_MS = 5000;

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  return new Anthropic({ apiKey, maxRetries: 0 });
}

async function callAnthropicWithRetry(
  anthropic: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming
): Promise<Anthropic.Message> {
  for (let attempt = 0; attempt <= MAX_API_RETRIES; attempt++) {
    try {
      return await anthropic.messages.create(params);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      const isRetryable = status === 429 || status === 529;
      if (isRetryable && attempt < MAX_API_RETRIES) {
        const delay = RATE_LIMIT_RETRY_MS * (attempt + 1);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Exhausted retries");
}

export const POST = withTenant(async (req, { tenantId, userId }) => {
  const { orgSlug } = await auth();

  const rl = rateLimit(`ai-chat:${userId}`, RATE_LIMITS.aiChat);
  if (!rl.success) {
    return NextResponse.json(
      { error: "For mange forespørsler. Vent litt før du prøver igjen." },
      { status: 429 }
    );
  }

  const chatSchema = z.object({
    messages: z
      .array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1, "Melding kan ikke være tom"),
      }))
      .min(1, "Minst én melding er påkrevd"),
    conversationId: z.string().uuid().nullable().optional(),
    pageContext: z.string().max(500).nullable().optional(),
  }).refine((d) => {
    const last = d.messages[d.messages.length - 1];
    return last.role === "user";
  }, { message: "Siste melding må være fra bruker", path: ["messages"] });

  const parsed = chatSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return zodError(parsed.error);

  const { messages, conversationId, pageContext: pagePath } = parsed.data;
  const lastUserMessage = messages[messages.length - 1];

  const classification = classifyQuery(lastUserMessage.content);
  if (!classification.onTopic && classification.confidence > 0.8) {
    return streamTextResponse(OFF_TOPIC_RESPONSE, conversationId);
  }

  try {
    const user = await currentUser();
    const userCtx = await getUserContext(
      userId,
      tenantId,
      user?.firstName ?? undefined,
      orgSlug ?? undefined
    );
    const pageCtx = pagePath ? getPageContext(pagePath) : null;

    if (pageCtx?.clientId) {
      const name = await getClientName(pageCtx.clientId, tenantId);
      if (name) pageCtx.clientName = name;
    }

    const mode = userCtx.onboardingCompleted ? "support" : "onboarding";
    const basePrompt = buildSystemPrompt(userCtx, pageCtx, mode);

    const [knowledgeResults, memories] = await Promise.all([
      searchKnowledge(lastUserMessage.content).catch(() => []),
      getUserMemories(userId, tenantId).catch(() => []),
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
    let smartMatchGroups: [string[], string[]][] | undefined;
    let suggestedTutorials: Array<{ id: string; name: string; description: string | null }> | undefined;

    let currentMessages = [...anthropicMessages];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await callAnthropicWithRetry(anthropic, {
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
          tenantId,
          userId
        );
        const resultObj = result as Record<string, unknown>;

        if (toolUse.name === "run_smart_match" && resultObj._matchGroups) {
          smartMatchGroups = resultObj._matchGroups as [string[], string[]][];
          delete resultObj._matchGroups;
        }

        if (toolUse.name === "list_tutorials" && Array.isArray(resultObj.tutorials)) {
          const tutorials = resultObj.tutorials as Array<{ id: string; navn: string; beskrivelse: string | null }>;
          if (tutorials.length > 0) {
            suggestedTutorials = tutorials.map((t) => ({
              id: t.id,
              name: t.navn,
              description: t.beskrivelse,
            }));
          }
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(resultObj),
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

    const actions: Array<{ type: string; matchGroups?: [string[], string[]][] }> = [];
    if (toolsUsed.includes("run_smart_match") && smartMatchGroups) {
      actions.push({ type: "smart_match_completed", matchGroups: smartMatchGroups });
    }
    if (toolsUsed.includes("send_report_email")) {
      actions.push({ type: "report_sent" });
    }

    const convId = await saveConversation(
      conversationId ?? null,
      userId,
      tenantId,
      messages.map((m) => ({ role: m.role, content: m.content })),
      responseText,
      mode,
      pagePath ?? null,
      toolsUsed,
      totalTokens
    );

    return streamTextResponse(responseText, convId, actions, suggestedTutorials);
  } catch (err: unknown) {
    console.error("[AI Chat] Error:", err);

    const status = (err as { status?: number }).status;
    if (status === 429) {
      return streamTextResponse(
        "Jeg trenger et lite øyeblikk — for mange forespørsler akkurat nå. Prøv igjen om noen sekunder."
      );
    }
    if (status === 529) {
      return streamTextResponse(
        "AI-tjenesten er midlertidig overbelastet. Prøv igjen om et øyeblikk."
      );
    }

    return NextResponse.json(
      { error: "Noe gikk galt. Prøv igjen senere." },
      { status: 500 }
    );
  }
});

function streamTextResponse(
  text: string,
  conversationId?: string | null,
  actions?: Array<{ type: string }>,
  suggestedTutorials?: Array<{ id: string; name: string; description: string | null }>
) {
  const payload = JSON.stringify({
    content: text,
    conversationId: conversationId ?? null,
    ...(actions && actions.length > 0 ? { actions } : {}),
    ...(suggestedTutorials && suggestedTutorials.length > 0 ? { suggestedTutorials } : {}),
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
