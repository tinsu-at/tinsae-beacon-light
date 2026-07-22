// Local, on-device notification scheduler for Beacon.
// Uses the browser Notification API. Persists preferences in localStorage
// and re-arms itself each time the page loads or a preference changes.
// Push notifications from a server would require additional infrastructure.

export type NotifKey =
  | "morningBriefing"
  | "eveningReflection"
  | "habitReminder"
  | "journalReminder"
  | "confidenceChallenge"
  | "dailyReview";

export type NotifPref = {
  enabled: boolean;
  time: string; // "HH:mm"
  title: string;
  body: string;
  sound?: boolean;
  vibrate?: boolean;
};

export type NotifPrefs = Record<NotifKey, NotifPref>;


export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  morningBriefing: {
    enabled: true,
    time: "07:00",
    title: "Morning briefing",
    body: "Let's plan the day. Beacon is ready when you are.",
  },
  confidenceChallenge: {
    enabled: true,
    time: "09:00",
    title: "Today's confidence challenge",
    body: "One small brave act builds a bolder you.",
  },
  habitReminder: {
    enabled: true,
    time: "12:30",
    title: "Habit check-in",
    body: "Log your habits — tiny reps compound.",
  },
  journalReminder: {
    enabled: true,
    time: "18:00",
    title: "Journal a moment",
    body: "Three lines about today is enough.",
  },
  eveningReflection: {
    enabled: true,
    time: "21:00",
    title: "Evening reflection",
    body: "Did today make you someone a child would be proud to imitate?",
  },
  dailyReview: {
    enabled: false,
    time: "22:00",
    title: "Daily review",
    body: "What went well? What can you improve tomorrow?",
  },
};

const KEY = "beacon-notif-prefs-v2";

export function loadNotifPrefs(): NotifPrefs {
  if (typeof localStorage === "undefined") return DEFAULT_NOTIF_PREFS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_NOTIF_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotifPrefs>;
    return { ...DEFAULT_NOTIF_PREFS, ...parsed } as NotifPrefs;
  } catch {
    return DEFAULT_NOTIF_PREFS;
  }
}

export function saveNotifPrefs(prefs: NotifPrefs) {
  localStorage.setItem(KEY, JSON.stringify(prefs));
  scheduleAll(prefs);
}

export async function requestNotifPermission(): Promise<NotificationPermission> {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  if (Notification.permission === "granted") return "granted";
  return await Notification.requestPermission();
}

export function notifPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission;
}

const timers = new Map<NotifKey, ReturnType<typeof setTimeout>>();

function nextFireMs(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  const now = new Date();
  const t = new Date();
  t.setHours(h, m, 0, 0);
  if (t.getTime() <= now.getTime()) t.setDate(t.getDate() + 1);
  return t.getTime() - now.getTime();
}

function routeFor(key: NotifKey): string {
  return key === "morningBriefing" || key === "eveningReflection" || key === "dailyReview"
    ? "/chat"
    : key === "habitReminder"
      ? "/habits"
      : key === "journalReminder"
        ? "/journal"
        : "/dashboard";
}

export function fireNotification(key: NotifKey, pref: NotifPref) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    if (pref.vibrate && "vibrate" in navigator) {
      try { navigator.vibrate?.([80, 40, 80]); } catch { /* noop */ }
    }
    const n = new Notification(pref.title, {
      body: pref.body,
      icon: "/icon-512.png",
      badge: "/icon-512.png",
      tag: `beacon-${key}`,
      silent: pref.sound === false,
    });
    n.onclick = () => {
      window.focus();
      window.location.href = routeFor(key);
    };
  } catch {
    // ignore
  }
}

function fire(key: NotifKey, pref: NotifPref) {
  fireNotification(key, pref);
}


export function scheduleAll(prefs: NotifPrefs = loadNotifPrefs()) {
  if (typeof window === "undefined") return;
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  for (const key of Object.keys(prefs) as NotifKey[]) {
    const pref = prefs[key];
    if (!pref.enabled) continue;
    const arm = () => {
      const delay = nextFireMs(pref.time);
      const id = setTimeout(() => {
        fire(key, pref);
        arm(); // schedule next day
      }, delay);
      timers.set(key, id);
    };
    arm();
  }
}
