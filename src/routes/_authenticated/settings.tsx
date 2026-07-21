import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Moon, Sun, BellRing } from "lucide-react";
import {
  DEFAULT_NOTIF_PREFS,
  loadNotifPrefs,
  saveNotifPrefs,
  requestNotifPermission,
  notifPermission,
  type NotifKey,
  type NotifPrefs,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Beacon" }] }),
  component: SettingsPage,
});

const NOTIF_LABELS: Record<NotifKey, { label: string; desc: string }> = {
  morningBriefing: { label: "Morning briefing", desc: "Plan the day with Beacon." },
  confidenceChallenge: { label: "Confidence challenge", desc: "One brave act per day." },
  habitReminder: { label: "Habit reminder", desc: "Log your habits, keep the streak." },
  journalReminder: { label: "Journal nudge", desc: "Three lines about today." },
  eveningReflection: { label: "Evening reflection", desc: "The Beacon Principle check-in." },
  dailyReview: { label: "Daily review", desc: "Wins, distractions, lessons." },
};

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile?.display_name) setName(profile.display_name);
  }, [profile]);

  useEffect(() => {
    setPrefs(loadNotifPrefs());
    setPermission(notifPermission());
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  function updatePref(key: NotifKey, patch: Partial<NotifPrefs[NotifKey]>) {
    const next: NotifPrefs = { ...prefs, [key]: { ...prefs[key], ...patch } };
    setPrefs(next);
    saveNotifPrefs(next);
  }

  async function enableNotifications() {
    const p = await requestNotifPermission();
    setPermission(p);
    if (p === "granted") {
      toast.success("Notifications enabled");
      saveNotifPrefs(prefs);
    } else {
      toast.error("Notification permission denied");
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8 md:px-6">
      <div>
        <h1 className="font-serif text-3xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Make Beacon yours.</p>
      </div>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label>Display name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" className="rounded-full">Save</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-xs text-muted-foreground">Choose light or dark.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")} className="rounded-full">Light</Button>
              <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")} className="rounded-full">Dark</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-serif text-lg">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
            <div className="flex items-center gap-3">
              <BellRing className="h-4 w-4" />
              <div>
                <p className="font-medium">Browser notifications</p>
                <p className="text-xs text-muted-foreground">
                  {permission === "granted"
                    ? "Enabled on this device."
                    : permission === "denied"
                      ? "Blocked — enable in your browser site settings."
                      : "Allow Beacon to remind you at the right time."}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              className="rounded-full"
              onClick={enableNotifications}
              disabled={permission === "granted"}
            >
              {permission === "granted" ? "Enabled" : "Enable"}
            </Button>
          </div>

          {(Object.keys(NOTIF_LABELS) as NotifKey[]).map((key) => (
            <div key={key} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border p-4">
              <div className="min-w-0">
                <p className="font-medium">{NOTIF_LABELS[key].label}</p>
                <p className="text-xs text-muted-foreground">{NOTIF_LABELS[key].desc}</p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  type="time"
                  value={prefs[key].time}
                  onChange={(e) => updatePref(key, { time: e.target.value })}
                  className="h-9 w-28"
                />
                <Switch
                  checked={prefs[key].enabled}
                  onCheckedChange={(v) => updatePref(key, { enabled: v })}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-muted-foreground">
            Reminders run locally on this device while Beacon is open or in the background. Keep the app installed for the most reliable delivery.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

