"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WORKING_PHRASES = [
  "Jeg ser på postene…",
  "Matcher beløp og datoer…",
  "Der fant jeg en til!",
  "Disse to skal mot hverandre…",
  "Jeg elsker å matche data.",
  "Nesten ferdig…",
  "Bare noen få igjen…",
];

const THINKING_PHRASES = [
  "Tenker…",
  "Analyserer…",
  "Leser kontekst…",
  "Sjekker…",
  "Kobler sammen…",
  "Vurderer…",
  "Ser nærmere…",
  "Formulerer…",
];

interface UseAiChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  loadingText: string;
  isWorking: boolean;
  workingText: string;
  error: string | null;
  conversationId: string | null;
  sendMessage: (text: string) => Promise<void>;
  reset: () => void;
}

export function useAiChat(): UseAiChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [workingText, setWorkingText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const pathname = usePathname();
  const animDoneResolveRef = useRef<(() => void) | null>(null);
  const workingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const thinkingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const handler = () => {
      if (animDoneResolveRef.current) {
        animDoneResolveRef.current();
        animDoneResolveRef.current = null;
      }
    };
    window.addEventListener("ai-smart-match-anim-done", handler);
    return () => window.removeEventListener("ai-smart-match-anim-done", handler);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
      setLoadingText("");
      return;
    }
    let idx = Math.floor(Math.random() * THINKING_PHRASES.length);
    setLoadingText(THINKING_PHRASES[idx]);
    thinkingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % THINKING_PHRASES.length;
      setLoadingText(THINKING_PHRASES[idx]);
    }, 2000);
    return () => {
      if (thinkingIntervalRef.current) {
        clearInterval(thinkingIntervalRef.current);
        thinkingIntervalRef.current = null;
      }
    };
  }, [isLoading]);

  const startWorkingPhrases = useCallback(() => {
    let idx = 0;
    setWorkingText(WORKING_PHRASES[0]);
    workingIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % WORKING_PHRASES.length;
      setWorkingText(WORKING_PHRASES[idx]);
    }, 1800);
  }, []);

  const stopWorkingPhrases = useCallback(() => {
    if (workingIntervalRef.current) {
      clearInterval(workingIntervalRef.current);
      workingIntervalRef.current = null;
    }
    setWorkingText("");
  }, []);

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

        if (data.navigation?.path) {
          window.dispatchEvent(
            new CustomEvent("ai-navigate", {
              detail: { path: data.navigation.path },
            })
          );
        }

        let hasSmartMatch = false;
        if (data.actions) {
          for (const action of data.actions as Array<{
            type: string;
            matchGroups?: [string[], string[]][];
          }>) {
            if (action.type === "smart_match_completed") {
              hasSmartMatch = true;

              setIsLoading(false);
              setIsWorking(true);
              startWorkingPhrases();

              window.dispatchEvent(
                new CustomEvent("ai-smart-match-done", {
                  detail: { matchGroups: action.matchGroups ?? [] },
                })
              );

              await new Promise<void>((resolve) => {
                animDoneResolveRef.current = resolve;
              });

              stopWorkingPhrases();
              setIsWorking(false);
            }
          }
        }

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: assistantContent,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        if (!hasSmartMatch) {
          setIsLoading(false);
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Noe gikk galt. Prøv igjen.";
        setError(msg);
        setIsLoading(false);
        setIsWorking(false);
        stopWorkingPhrases();
      }
    },
    [messages, isLoading, pathname, startWorkingPhrases, stopWorkingPhrases]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
    setIsWorking(false);
    stopWorkingPhrases();
    conversationIdRef.current = null;
  }, [stopWorkingPhrases]);

  return {
    messages,
    isLoading,
    loadingText,
    isWorking,
    workingText,
    error,
    conversationId: conversationIdRef.current,
    sendMessage,
    reset,
  };
}
