import { db } from "@/lib/db";
import {
  knowledgeArticles,
  knowledgeSnippets,
  knowledgeFaq,
  productGuides,
} from "@/lib/db/schema";
import { sql, ilike, or, eq } from "drizzle-orm";
import { generateEmbedding } from "./embeddings";
import type { SearchResult } from "./types";

interface SearchOptions {
  category?: string;
  limit?: number;
  role?: string;
}

export async function searchKnowledge(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const limit = options.limit ?? 5;
  const results: SearchResult[] = [];
  const seenIds = new Set<string>();

  function addResult(r: SearchResult) {
    if (!seenIds.has(r.id)) {
      seenIds.add(r.id);
      results.push(r);
    }
  }

  // 1. Snippet trigger match
  const snippets = await findSnippetsByTrigger(query);
  for (const s of snippets) addResult(s);

  // 2. Full-text search on knowledge_articles (Norwegian stemming)
  const ftsResults = await fullTextSearch(query, options.category);
  for (const r of ftsResults) addResult(r);

  // 3. FAQ match
  const faqResults = await faqSearch(query);
  for (const r of faqResults) addResult(r);

  // 4. Semantic search (fallback if < 3 results)
  if (results.length < 3) {
    try {
      const semanticResults = await semanticSearch(query, limit);
      for (const r of semanticResults) addResult(r);
    } catch {
      // Embedding service may be unavailable; continue with what we have
    }
  }

  // 5. Product guides (only for "how to" queries)
  if (isHowToQuery(query)) {
    const guideResults = await guideSearch(query);
    for (const r of guideResults) addResult(r);
  }

  return results.slice(0, limit);
}

async function findSnippetsByTrigger(query: string): Promise<SearchResult[]> {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return [];

  const rows = await db
    .select({
      id: knowledgeSnippets.id,
      fact: knowledgeSnippets.fact,
      context: knowledgeSnippets.context,
      priority: knowledgeSnippets.priority,
    })
    .from(knowledgeSnippets)
    .where(
      or(
        sql`${knowledgeSnippets.triggerPhrases} && ${sql`ARRAY[${sql.join(
          words.map((w) => sql`${w}`),
          sql`, `
        )}]::text[]`}`,
        eq(knowledgeSnippets.alwaysInclude, true)
      )
    )
    .orderBy(sql`${knowledgeSnippets.priority} DESC`)
    .limit(3);

  return rows.map((r) => ({
    id: r.id,
    type: "snippet" as const,
    title: r.fact.slice(0, 80),
    content: r.fact,
    summary: r.context,
    priority: r.priority ?? 0,
  }));
}

async function fullTextSearch(
  query: string,
  category?: string
): Promise<SearchResult[]> {
  const conditions = [
    sql`fts @@ websearch_to_tsquery('norwegian', ${query})`,
    eq(knowledgeArticles.status, "published"),
  ];
  if (category) {
    conditions.push(eq(knowledgeArticles.category, category));
  }

  const rows = await db
    .select({
      id: knowledgeArticles.id,
      title: knowledgeArticles.title,
      content: knowledgeArticles.content,
      summary: knowledgeArticles.summary,
      category: knowledgeArticles.category,
      source: knowledgeArticles.source,
      sourceUrl: knowledgeArticles.sourceUrl,
    })
    .from(knowledgeArticles)
    .where(sql`${sql.join(conditions, sql` AND `)}`)
    .orderBy(
      sql`ts_rank(fts, websearch_to_tsquery('norwegian', ${query})) DESC`
    )
    .limit(5);

  return rows.map((r) => ({
    id: r.id,
    type: "article" as const,
    title: r.title,
    content: r.summary ?? r.content.slice(0, 500),
    summary: r.summary,
    category: r.category,
    source: r.source,
    sourceUrl: r.sourceUrl,
  }));
}

async function faqSearch(query: string): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: knowledgeFaq.id,
      question: knowledgeFaq.question,
      answer: knowledgeFaq.answer,
      category: knowledgeFaq.category,
      feature: knowledgeFaq.feature,
      priority: knowledgeFaq.priority,
    })
    .from(knowledgeFaq)
    .where(
      sql`to_tsvector('norwegian', ${knowledgeFaq.question}) @@ websearch_to_tsquery('norwegian', ${query})`
    )
    .orderBy(sql`${knowledgeFaq.priority} DESC`)
    .limit(3);

  return rows.map((r) => ({
    id: r.id,
    type: "faq" as const,
    title: r.question,
    content: r.answer,
    category: r.category,
    priority: r.priority ?? 0,
  }));
}

async function semanticSearch(
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const embedding = await generateEmbedding(query);
  const embeddingStr = `[${embedding.join(",")}]`;

  const rows = await db.execute<{
    id: string;
    title: string;
    content: string;
    summary: string | null;
    category: string;
    source: string | null;
    source_url: string | null;
    similarity: number;
  }>(
    sql`SELECT * FROM match_knowledge(${embeddingStr}::vector, 0.7, ${limit})`
  );

  return (rows as unknown as Array<{
    id: string;
    title: string;
    content: string;
    summary: string | null;
    category: string;
    source: string | null;
    source_url: string | null;
    similarity: number;
  }>).map((r) => ({
    id: r.id,
    type: "article" as const,
    title: r.title,
    content: r.summary ?? r.content.slice(0, 500),
    summary: r.summary,
    category: r.category,
    source: r.source,
    sourceUrl: r.source_url,
    similarity: r.similarity,
  }));
}

async function guideSearch(query: string): Promise<SearchResult[]> {
  const rows = await db
    .select({
      id: productGuides.id,
      title: productGuides.title,
      description: productGuides.description,
      feature: productGuides.feature,
      steps: productGuides.steps,
    })
    .from(productGuides)
    .where(
      sql`to_tsvector('norwegian', ${productGuides.title} || ' ' || coalesce(${productGuides.description}, '')) @@ websearch_to_tsquery('norwegian', ${query})`
    )
    .limit(2);

  return rows.map((r) => ({
    id: r.id,
    type: "guide" as const,
    title: r.title,
    content: r.description ?? "",
    category: r.feature,
  }));
}

function isHowToQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return /hvordan|guide|sett opp|koble|steg for steg|instruksjon|veiledning|kom i gang/.test(
    lower
  );
}
