import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Compass, Flame, Target, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-forest text-primary-foreground">
            <Compass className="h-5 w-5" />
          </div>
          <span className="font-serif text-xl font-semibold tracking-tight">Beacon</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild className="rounded-full">
            <Link to="/auth" search={{ mode: "signup" } as never}>
              Get started
            </Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6">
        <section className="pb-16 pt-10 md:pb-24 md:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              A quiet, disciplined space for personal growth
            </div>
            <h1 className="font-serif text-4xl font-semibold leading-[1.05] text-foreground md:text-6xl">
              Become someone a child would be{" "}
              <span className="text-primary">proud to imitate.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
              Beacon is your coach, mentor, and accountability partner. Build discipline,
              confidence, and daily habits — one honest reflection at a time.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="rounded-full">
                <Link to="/auth" search={{ mode: "signup" } as never}>
                  Start your journey <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full">
                <Link to="/auth">I already have an account</Link>
              </Button>
            </div>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Target,
                title: "Daily focus",
                body: "Plan tasks, set priorities, and know exactly what matters today.",
              },
              {
                icon: Flame,
                title: "Habits that stick",
                body: "Track streaks across study, exercise, prayer, sleep and your own habits.",
              },
              {
                icon: Sparkles,
                title: "Confidence, built daily",
                body: "A small confidence challenge every day. Small reps, real growth.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="hover-lift rounded-3xl border border-border bg-card p-6 shadow-elegant"
              >
                <div className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-beige text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-serif text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} Beacon. Lead by example.
        </footer>
      </main>
    </div>
  );
}
