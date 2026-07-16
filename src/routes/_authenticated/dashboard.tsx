import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  challengeOfDay,
  formatLongDate,
  greeting,
  quoteOfDay,
  todayISO,
} from "@/lib/beacon-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  BookText,
  CheckSquare,
  Flame,
  Quote,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Beacon" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useAuth();
  const today = todayISO();
  const quote = quoteOfDay(today);
  const challenge = challengeOfDay(today);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  const { data: topTask } = useQuery({
    queryKey: ["top-task", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user!.id)
        .eq("completed", false)
        .order("priority", { ascending: false })
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const { data: habitProgress } = useQuery({
    queryKey: ["habit-progress", user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data: habits } = await supabase.from("habits").select("id").eq("user_id", user!.id).eq("archived", false);
      const { data: logs } = await supabase
        .from("habit_logs")
        .select("id")
        .eq("user_id", user!.id)
        .eq("log_date", today);
      return { total: habits?.length ?? 0, done: logs?.length ?? 0 };
    },
  });

  const { data: streak } = useQuery({
    queryKey: ["weekly-streak", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 6);
      const startStr = start.toISOString().slice(0, 10);
      const { data } = await supabase
        .from("habit_logs")
        .select("log_date")
        .eq("user_id", user!.id)
        .gte("log_date", startStr);
      const days = new Set((data ?? []).map((d) => d.log_date));
      return days.size;
    },
  });

  const pct = habitProgress && habitProgress.total > 0
    ? Math.round((habitProgress.done / habitProgress.total) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <p className="text-sm text-muted-foreground">{formatLongDate()}</p>
        <h1 className="font-serif text-3xl font-semibold md:text-4xl">
          {greeting()}, {profile?.display_name ?? "friend"}.
        </h1>
        <p className="mt-1 text-muted-foreground">A steady day is a strong day. Here's your compass.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-3xl border-border bg-card md:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-gold">
              <Quote className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Quote of the day</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-xl leading-snug md:text-2xl">"{quote.text}"</p>
            <p className="mt-2 text-sm text-muted-foreground">— {quote.author}</p>
          </CardContent>
        </Card>

        <Card className="rounded-3xl border-border bg-primary text-primary-foreground shadow-elegant">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              <CardTitle className="text-sm font-medium">Confidence challenge</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="font-serif text-lg leading-snug">{challenge}</p>
            <Button asChild size="sm" variant="secondary" className="mt-4 rounded-full">
              <Link to="/habits">Log it</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CheckSquare className="h-4 w-4 text-primary" /> Today's top priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topTask ? (
              <>
                <p className="font-medium">{topTask.title}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full capitalize">
                    {topTask.priority}
                  </Badge>
                  {topTask.due_date && (
                    <span className="text-xs text-muted-foreground">Due {topTask.due_date}</span>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No open tasks. Plan your day →</p>
            )}
            <Button asChild variant="ghost" size="sm" className="mt-3 px-0 text-primary">
              <Link to="/tasks">Open tasks →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Flame className="h-4 w-4 text-gold" /> Habit progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-3xl font-semibold">
                {habitProgress?.done ?? 0}/{habitProgress?.total ?? 0}
              </span>
              <span className="text-xs text-muted-foreground">today</span>
            </div>
            <Progress value={pct} className="mt-3" />
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-primary" /> Weekly streak
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-serif text-3xl font-semibold">{streak ?? 0}</span>
            <span className="ml-1 text-sm text-muted-foreground">/ 7 days active</span>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 font-serif text-lg font-semibold">Quick actions</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/tasks", label: "Add a task", icon: CheckSquare },
            { to: "/habits", label: "Log a habit", icon: Flame },
            { to: "/journal", label: "Write journal", icon: BookText },
            { to: "/goals", label: "Set a goal", icon: Target },
          ].map((q) => (
            <Button
              asChild
              key={q.to}
              variant="outline"
              className="hover-lift h-auto justify-start gap-3 rounded-2xl border-border bg-card p-4 text-left"
            >
              <Link to={q.to}>
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-beige text-primary">
                  <q.icon className="h-4 w-4" />
                </span>
                <span className="font-medium">{q.label}</span>
              </Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
