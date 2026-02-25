"use client";

import { useCallback, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface UseAiChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  sendMessage: (text: string) => Promise<void>;
  reset: () => void;
}

export function useAiChat(): UseAiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const pathname = usePathname();

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      const userMessage: ChatMessage = { role: "user", content: trimmed };
      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);
      setError(null);

      try {
        const allMessages = [...messages, userMessage];

        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: allMessages,
            conversationId: conversationIdRef.current,
            pageContext: pathname,
          }),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(
            errBody?.error ?? `Feil fra server (${res.status})`
          );
        }

        const data = await res.json();
        const assistantContent = data.content ?? data.message ?? "";

        if (data.conversationId) {
          conversationIdRef.current = data.conversationId;
        }

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: assistantContent,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (data.navigation?.path) {
          window.dispatchEvent(
            new CustomEvent("ai-navigate", {
              detail: { path: data.navigation.path },
            })
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.";
        setError(msg);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, pathname]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    conversationIdRef.current = null;
  }, []);

  return {
    messages,
    isLoading,
    error,
    conversationId: conversationIdRef.current,
    sendMessage,
    reset,
  };
}
