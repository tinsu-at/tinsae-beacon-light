import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  MessageCircle,
  CheckSquare,
  Flame,
  BookText,
} from "lucide-react";

const items = [
  { title: "Home", url: "/dashboard", icon: LayoutDashboard },
  { title: "Chat", url: "/chat", icon: MessageCircle },
  { title: "Tasks", url: "/tasks", icon: CheckSquare },
  { title: "Habits", url: "/habits", icon: Flame },
  { title: "Journal", url: "/journal", icon: BookText },
] as const;

export function MobileNav() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  return (
    <nav
      className="glass-panel fixed inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl px-2 py-2 shadow-elegant md:hidden"
      aria-label="Primary"
    >
      {items.map((item) => {
        const active = pathname === item.url;
        return (
          <Link
            key={item.url}
            to={item.url}
            className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[10px] font-medium transition-colors ${
              active ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span
              className={`grid h-8 w-8 place-items-center rounded-xl transition-colors ${
                active ? "bg-primary text-primary-foreground shadow-soft" : "bg-transparent"
              }`}
            >
              <item.icon className="h-4 w-4" />
            </span>
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
