import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { getConversationMessages } from "@/lib/conversations.functions";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Sparkles, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  isSpeechRecognitionSupported,
  isSpeechSynthesisSupported,
  startDictation,
  speak,
  stopSpeaking,
  type DictationHandle,
} from "@/lib/voice";
import { toast } from "sonner";

const searchSchema = z.object({
  starter: z.string().optional(),
});

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  ssr: false,
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Chat with Beacon" }] }),
  component: ChatThread,
});

function ChatThread() {
  const { threadId } = Route.useParams();
  const { starter } = Route.useSearch();
  const navigate = useNavigate();
  const getMessages = useServerFn(getConversationMessages);

  const { data, isLoading, error } = useQuery({
    queryKey: ["conversation", threadId],
    queryFn: () => getMessages({ data: { id: threadId } }),
    retry: false,
  });

  useEffect(() => {
    if (error) toast.error((error as Error).message);
  }, [error]);

  const initialMessages = useMemo<UIMessage[]>(() => {
    if (!data) return [];
    return data.messages.map((m) => ({
      id: m.id,
      role: m.role as UIMessage["role"],
      parts: (m.parts ?? []) as UIMessage["parts"],
    }));
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Loading conversation…
      </div>
    );
  }

  return (
    <ChatWindow
      key={threadId}
      threadId={threadId}
      initialMessages={initialMessages}
      starter={starter}
      onStarterConsumed={() =>
        navigate({
          to: "/chat/$threadId",
          params: { threadId },
          search: { starter: undefined },
          replace: true,
        })
      }
    />
  );
}

function ChatWindow({
  threadId,
  initialMessages,
  starter,
  onStarterConsumed,
}: {
  threadId: string;
  initialMessages: UIMessage[];
  starter?: string;
  onStarterConsumed: () => void;
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dictationRef = useRef<DictationHandle | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const voiceSupported = isSpeechRecognitionSupported();
  const ttsSupported = isSpeechSynthesisSupported();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
        body: () => ({ conversationId: threadId }),
      }),
    [threadId],
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    id: threadId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message),
  });

  const isBusy = status === "submitted" || status === "streaming";

  // Auto-send starter prompt once
  const starterSentRef = useRef(false);
  useEffect(() => {
    if (starter && !starterSentRef.current && messages.length === 0) {
      starterSentRef.current = true;
      sendMessage({ text: starter });
      onStarterConsumed();
    }
  }, [starter, sendMessage, messages.length, onStarterConsumed]);

  // Focus textarea
  useEffect(() => {
    if (!isBusy) textareaRef.current?.focus();
  }, [isBusy, threadId]);

  async function handleSubmit(msg: PromptInputMessage) {
    const text = msg.text.trim();
    if (!text || isBusy) return;
    setInput("");
    await sendMessage({ text });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.length === 0 && (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-forest text-primary-foreground shadow-elegant">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="font-serif text-2xl font-semibold">Beacon is listening</h2>
              <p className="text-sm text-muted-foreground">
                Share what's on your mind. What do you want to move forward today?
              </p>
            </div>
          )}

          {messages.map((m) => {
            const text = m.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join("");
            return (
              <Message key={m.id} from={m.role}>
                <MessageContent>
                  {m.role === "assistant" ? (
                    <MessageResponse>{text}</MessageResponse>
                  ) : (
                    <span className="whitespace-pre-wrap">{text}</span>
                  )}
                </MessageContent>
              </Message>
            );
          })}

          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Beacon is thinking…</Shimmer>
              </MessageContent>
            </Message>
          )}

          {error && (
            <p className="text-center text-xs text-destructive">{error.message}</p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border/60 bg-background/70 px-4 py-4 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputTextarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message Beacon…"
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit
                size="icon-sm"
                className="rounded-full h-9 w-9"
                status={status}
                onStop={stop}
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
