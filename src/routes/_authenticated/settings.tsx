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
import { Moon, Sun } from "lucide-react";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — Beacon" }] }),
  component: SettingsPage,
});

const NOTIF_KEY = "beacon-notif";

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { theme, setTheme } = useTheme();
  const [name, setName] = useState("");
  const [notifDaily, setNotifDaily] = useState(true);
  const [notifChallenge, setNotifChallenge] = useState(true);

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
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        setNotifDaily(p.daily ?? true);
        setNotifChallenge(p.challenge ?? true);
      }
    } catch {}
  }, []);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user.id);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["profile"] });
  }

  function saveNotif(next: { daily?: boolean; challenge?: boolean }) {
    const merged = { daily: notifDaily, challenge: notifChallenge, ...next };
    setNotifDaily(merged.daily);
    setNotifChallenge(merged.challenge);
    localStorage.setItem(NOTIF_KEY, JSON.stringify(merged));
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
          <NotifRow
            label="Daily planner reminder"
            desc="A gentle nudge to plan your day."
            checked={notifDaily}
            onChange={(v) => saveNotif({ daily: v })}
          />
          <NotifRow
            label="Confidence challenge"
            desc="A new challenge every morning."
            checked={notifChallenge}
            onChange={(v) => saveNotif({ challenge: v })}
          />
          <p className="text-xs text-muted-foreground">
            Preferences are saved on this device. Push notifications will arrive in a future release.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function NotifRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border p-4">
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
