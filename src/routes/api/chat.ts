import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

type ChatBody = {
  messages?: UIMessage[];
  conversationId?: string;
};

const SYSTEM_PROMPT = `You are Beacon — a calm, honest, wise, and encouraging AI companion for personal growth, discipline, and confidence. You speak like a warm, grounded mentor: brief, direct, kind. You never flatter. You don't hedge. You reflect back what matters and gently challenge what doesn't.

Guiding principle — The Beacon Principle: help the user become someone a child would be proud to imitate.

English Coach mode:
- If the user's message contains an English mistake (grammar, word choice, or awkward phrasing), begin your reply with a single short line: "✍️ Small fix: <corrected sentence>" — then continue naturally with your actual response.
- If there are no mistakes worth mentioning, skip the fix line completely. Do not force it.
- Never lecture. One small fix per message maximum.

Style:
- Short paragraphs. Plain language. No filler like "Great question!".
- Ask one meaningful follow-up when useful, not always.
- Use markdown sparingly — bold for anchors, lists only when they truly help.
- When the user shares a struggle, acknowledge briefly, then move toward one small, doable next step.`;

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization");
        if (!auth?.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);

        const SUPABASE_URL = process.env.SUPABASE_URL;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || !LOVABLE_API_KEY) {
          return new Response("Server misconfigured", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: {
            headers: { Authorization: `Bearer ${token}` },
            fetch: (input, init) => {
              const h = new Headers(init?.headers);
              if (h.get("Authorization") === `Bearer ${SUPABASE_PUBLISHABLE_KEY}`) {
                h.delete("Authorization");
              }
              h.set("apikey", SUPABASE_PUBLISHABLE_KEY);
              if (!h.has("Authorization")) h.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers: h });
            },
          },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });

        const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
        if (claimsErr || !claims?.claims?.sub) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = claims.claims.sub as string;

        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        const conversationId = body.conversationId;
        if (!Array.isArray(messages) || !conversationId) {
          return new Response("Missing messages or conversationId", { status: 400 });
        }

        // Verify conversation ownership
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .select("id, title")
          .eq("id", conversationId)
          .maybeSingle();
        if (convErr || !conv) {
          return new Response("Conversation not found", { status: 404 });
        }

        // Persist the latest user message (last item in messages)
        const lastMsg = messages[messages.length - 1];
        if (lastMsg?.role === "user") {
          await supabase.from("chat_messages").insert({
            conversation_id: conversationId,
            user_id: userId,
            role: "user",
            parts: lastMsg.parts as never,
          });

          // Auto-title from first user message when still default
          if (conv.title === "New chat") {
            const text = lastMsg.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim()
              .slice(0, 60);
            if (text) {
              await supabase
                .from("conversations")
                .update({ title: text })
                .eq("id", conversationId);
            }
          }
        }

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3.5-flash");

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
        });

        return result.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: async ({ responseMessage, isAborted }) => {
            if (isAborted) return;
            if (!responseMessage.parts || responseMessage.parts.length === 0) return;
            await supabase.from("chat_messages").insert({
              conversation_id: conversationId,
              user_id: userId,
              role: "assistant",
              parts: responseMessage.parts as never,
            });
            await supabase
              .from("conversations")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", conversationId);
          },
          onError: (err) => {
            console.error("[chat] stream error", err);
            return err instanceof Error ? err.message : "Chat error";
          },
        });
      },
    },
  },
});
