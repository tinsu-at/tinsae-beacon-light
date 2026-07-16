import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, Flame, Plus, Trash2 } from "lucide-react";
import { todayISO } from "@/lib/beacon-data";

type Habit = { id: string; name: string; icon: string | null; is_default: boolean; archived: boolean };
type Log = { habit_id: string; log_date: string };

export const Route = createFileRoute("/_authenticated/habits")({
  head: () => ({ meta: [{ title: "Habits — Beacon" }] }),
  component: HabitsPage,
});

function HabitsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const today = todayISO();
  const [newName, setNewName] = useState("");

  const { data: habits = [] } = useQuery({
    queryKey: ["habits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("habits")
        .select("*")
        .eq("user_id", user!.id)
        .eq("archived", false)
        .order("created_at", { ascending: true });
      return (data ?? []) as Habit[];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["habit-logs-30", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 60);
      const { data } = await supabase
        .from("habit_logs")
        .select("habit_id, log_date")
        .eq("user_id", user!.id)
        .gte("log_date", start.toISOString().slice(0, 10));
      return (data ?? []) as Log[];
    },
  });

  const streaks = useMemo(() => {
    const byHabit: Record<string, Set<string>> = {};
    for (const l of logs) {
      byHabit[l.habit_id] ??= new Set();
      byHabit[l.habit_id].add(l.log_date);
    }
    const out: Record<string, number> = {};
    for (const h of habits) {
      const set = byHabit[h.id] ?? new Set();
      let s = 0;
      const d = new Date();
      while (set.has(d.toISOString().slice(0, 10))) {
        s++;
        d.setDate(d.getDate() - 1);
      }
      out[h.id] = s;
    }
    return out;
  }, [logs, habits]);

  const todayLogs = useMemo(() => new Set(logs.filter((l) => l.log_date === today).map((l) => l.habit_id)), [logs, today]);

  async function toggleToday(habit: Habit) {
    if (!user) return;
    if (todayLogs.has(habit.id)) {
      const { error } = await supabase
        .from("habit_logs")
        .delete()
        .eq("user_id", user.id)
        .eq("habit_id", habit.id)
        .eq("log_date", today);
      if (error) toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("habit_logs")
        .insert({ user_id: user.id, habit_id: habit.id, log_date: today });
      if (error) toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["habit-logs-30"] });
    qc.invalidateQueries({ queryKey: ["habit-progress"] });
    qc.invalidateQueries({ queryKey: ["weekly-streak"] });
  }

  async function addHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !newName.trim()) return;
    const { error } = await supabase.from("habits").insert({ user_id: user.id, name: newName.trim() });
    if (error) return toast.error(error.message);
    setNewName("");
    qc.invalidateQueries({ queryKey: ["habits"] });
  }

  async function removeHabit(id: string) {
    const { error } = await supabase.from("habits").update({ archived: true }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["habits"] });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Habits</h1>
        <p className="text-sm text-muted-foreground">Small reps. Compound results.</p>
      </div>

      <form onSubmit={addHabit} className="flex gap-2">
        <Input
          placeholder="Add a custom habit — e.g. Morning walk"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button type="submit" className="rounded-full">
          <Plus className="mr-1 h-4 w-4" /> Add
        </Button>
      </form>

      <div className="grid gap-3 sm:grid-cols-2">
        {habits.map((h) => {
          const done = todayLogs.has(h.id);
          return (
            <Card key={h.id} className="hover-lift flex items-center gap-3 rounded-2xl p-4">
              <button
                aria-label={done ? "Mark as not done" : "Mark done"}
                onClick={() => toggleToday(h)}
                className={`grid h-11 w-11 place-items-center rounded-xl transition ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : "bg-beige text-primary hover:bg-accent"
                }`}
              >
                <Check className="h-5 w-5" />
              </button>
              <div className="flex-1">
                <p className="font-medium">{h.name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline" className="rounded-full text-xs">
                    <Flame className="mr-1 h-3 w-3 text-gold" />
                    {streaks[h.id] ?? 0} day streak
                  </Badge>
                  {h.is_default && (
                    <span className="text-xs text-muted-foreground">Default</span>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeHabit(h.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
