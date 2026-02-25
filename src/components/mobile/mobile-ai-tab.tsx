"use client";

import { useRef, useEffect, useState, type FormEvent } from "react";
import { SendHorizonal, RotateCcw, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAiChat } from "@/hooks/use-ai-chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SUGGESTED_QUESTIONS = [
  "Hvilke frister har vi de neste 30 dagene?",
  "Vis umatchede poster for alle klienter",
  "Hvordan importerer jeg banktransaksjoner?",
  "Forklar hvordan Smart Match fungerer",
];

export function MobileAiTab() {
  const { messages, isLoading, error, sendMessage, reset } = useAiChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
    inputRef.current?.focus();
  };

  const handleSuggestion = (q: string) => {
    sendMessage(q);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {!hasMessages ? (
          <div className="flex flex-col items-center justify-center h-full gap-6 px-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[oklch(0.95_0.04_155)]">
              <Sparkles className="h-7 w-7 text-[oklch(0.55_0.18_155)]" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold">Revizo AI</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Spor meg om avstemminger, frister, import eller noe annet.
              </p>
            </div>
            <div className="w-full space-y-2">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSuggestion(q)}
                  className="w-full rounded-lg border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl bg-muted px-4 py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t bg-background px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          {hasMessages && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={reset}
              title="Ny samtale"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Spor Revizo AI…"
            rows={1}
            className="flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            style={{ maxHeight: 120 }}
          />
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 shrink-0"
            disabled={isLoading || !input.trim()}
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
