import { createFileRoute, Link, Outlet, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { MessageSquarePlus, Trash2, Sparkles } from "lucide-react";
import {
  listConversations,
  createConversation,
  deleteConversation,
} from "@/lib/conversations.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat")({
  ssr: false,
  head: () => ({ meta: [{ title: "Chat with Beacon" }] }),
  component: ChatLayout,
});

function ChatLayout() {
  const list = useServerFn(listConversations);
  const create = useServerFn(createConversation);
  const del = useServerFn(deleteConversation);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { threadId?: string };

  const { data: threads = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: () => list(),
  });

  const createMut = useMutation({
    mutationFn: async () => create(),
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      navigate({ to: "/chat/$threadId", params: { threadId: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => del({ data: { id } }),
    onSuccess: (_r, id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      if (params.threadId === id) navigate({ to: "/chat" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full">
      {/* Threads sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col border-r border-border/60 bg-card/40 backdrop-blur md:flex">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-7 w-7 place-items-center rounded-lg gradient-forest text-primary-foreground">
              <Sparkles className="h-3.5 w-3.5" />
            </div>
            <span className="font-serif text-sm font-semibold">Beacon Chats</span>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            aria-label="New chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 px-2 pb-4">
          <div className="flex flex-col gap-1">
            {threads.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No chats yet. Start one to begin.
              </p>
            )}
            {threads.map((t) => {
              const active = params.threadId === t.id;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "group flex items-center gap-1 rounded-xl px-1 transition-colors",
                    active ? "bg-primary/10" : "hover:bg-muted/60",
                  )}
                >
                  <Link
                    to="/chat/$threadId"
                    params={{ threadId: t.id }}
                    className="flex-1 truncate rounded-xl px-3 py-2 text-sm"
                  >
                    {t.title || "New chat"}
                  </Link>
                  <button
                    type="button"
                    aria-label="Delete chat"
                    onClick={() => delMut.mutate(t.id)}
                    className="mr-1 opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Outlet />
      </div>
    </div>
  );
}
