import { createFileRoute } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({ meta: [{ title: "Chat with Beacon" }] }),
  component: ChatPage,
});

function ChatPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
      <Card className="glass-panel animate-fade-up rounded-3xl border-border/60 shadow-soft">
        <CardContent className="flex flex-col items-center gap-4 px-6 py-16 text-center">
          <div className="animate-float grid h-14 w-14 place-items-center rounded-2xl gradient-forest text-primary-foreground shadow-elegant">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="font-serif text-3xl font-semibold md:text-4xl">Chat with Beacon</h1>
          <p className="max-w-lg text-muted-foreground">
            Your AI companion for discipline, confidence, and growth is coming next. It will
            remember what matters to you and coach you in your own voice.
          </p>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Arriving in the next phase
          </span>
        </CardContent>
      </Card>
    </div>
  );
}
