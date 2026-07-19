import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
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

        // Build the last user text for memory retrieval + extraction
        const lastUserText =
          lastMsg?.role === "user"
            ? lastMsg.parts.map((p) => (p.type === "text" ? p.text : "")).join(" ").trim()
            : "";

        // Retrieve relevant long-term memories via pgvector
        let memoryContext = "";
        if (lastUserText) {
          try {
            const { embedText, toPgVector } = await import("@/lib/embeddings.server");
            const emb = await embedText(lastUserText);
            const { data: matches } = await supabase.rpc("match_memories", {
              query_embedding: toPgVector(emb) as unknown as string,
              match_count: 6,
            });
            const relevant = (matches ?? []).filter(
              (m: { similarity: number }) => m.similarity > 0.55,
            );
            if (relevant.length) {
              memoryContext =
                "\n\nLong-term memory about the user (retrieved for this turn):\n" +
                relevant
                  .map(
                    (m: { category: string; content: string }) =>
                      `- [${m.category}] ${m.content}`,
                  )
                  .join("\n");
            }
          } catch (e) {
            console.warn("[chat] memory retrieval failed", e);
          }
        }

        // Recent conversation title context (last 5 threads)
        let recentContext = "";
        try {
          const { data: recent } = await supabase
            .from("conversations")
            .select("title, updated_at")
            .neq("id", conversationId)
            .order("updated_at", { ascending: false })
            .limit(5);
          if (recent?.length) {
            recentContext =
              "\n\nRecent conversation topics: " +
              recent.map((r) => `"${r.title}"`).join(", ");
          }
        } catch {}

        const nowLine = `\n\nCurrent local date/time reference: ${new Date().toISOString()}`;
        const composedSystem = SYSTEM_PROMPT + nowLine + memoryContext + recentContext;

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3.5-flash");

        const result = streamText({
          model,
          system: composedSystem,
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

            // Fire-and-forget: extract durable memories from this exchange
            if (!lastUserText) return;
            const assistantText = responseMessage.parts
              .map((p) => (p.type === "text" ? p.text : ""))
              .join(" ")
              .trim();
            extractAndSaveMemories({
              userText: lastUserText,
              assistantText,
              userId,
              supabase,
              apiKey: LOVABLE_API_KEY,
            }).catch((e) => console.warn("[chat] memory extract failed", e));
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

type SupabaseClientLike = ReturnType<typeof createClient<Database>>;

async function extractAndSaveMemories(opts: {
  userText: string;
  assistantText: string;
  userId: string;
  supabase: SupabaseClientLike;
  apiKey: string;
}) {
  const { userText, assistantText, userId, supabase, apiKey } = opts;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: "google/gemini-3.5-flash",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract DURABLE personal facts about the user from a single chat exchange. Only save specific, useful, long-term information: goals, current projects, habits, routines, preferences, achievements, strengths, weaknesses, important reflections. Ignore small talk, one-off feelings, and generic wisdom. Return strict JSON: {\"items\":[{\"content\":string, \"category\":\"goal|project|habit|routine|preference|fact|achievement|strength|weakness|reflection\"}]}. Return {\"items\":[]} if nothing is worth saving. Max 3 items. Each content is one clear declarative sentence written in third person, e.g. \"User is building an English coaching app called Beacon.\"",
        },
        {
          role: "user",
          content: `USER MESSAGE:\n${userText}\n\nASSISTANT REPLY:\n${assistantText}`,
        },
      ],
    }),
  });
  if (!res.ok) return;
  const json = (await res.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  let parsed: { items?: Array<{ content: string; category: string }> } = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    return;
  }
  const items = (parsed.items ?? []).filter(
    (i) => i && typeof i.content === "string" && i.content.length > 5,
  );
  if (!items.length) return;

  const { embedText, toPgVector } = await import("@/lib/embeddings.server");
  for (const item of items.slice(0, 3)) {
    try {
      const emb = await embedText(item.content);
      await supabase.from("memories").insert({
        user_id: userId,
        content: item.content,
        category: item.category || "fact",
        source: "chat",
        embedding: toPgVector(emb) as unknown as string,
      });
    } catch (e) {
      console.warn("[chat] failed to save memory", e);
    }
  }
}
