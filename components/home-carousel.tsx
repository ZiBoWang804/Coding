"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function HomeCarousel({ slides }: { slides: Array<{ eyebrow: string; title: string; description: string }> }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const current = slides[active];

  return (
    <div className="surface-card rounded-[1.9rem] p-5 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="hero-kicker">{current.eyebrow}</div>
          <h3 className="font-display mt-3 text-2xl font-semibold leading-tight md:text-[2rem]">{current.title}</h3>
        </div>
        <div className="font-display text-4xl text-white/36 md:text-5xl">{String(active + 1).padStart(2, "0")}</div>
      </div>

      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/76">{current.description}</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {slides.map((slide, index) => {
          const isActive = index === active;

          return (
            <button
              key={slide.title}
              type="button"
              aria-label={`切换到第 ${index + 1} 条首页灵感`}
              onClick={() => setActive(index)}
              className={cn(
                "rounded-[1.35rem] border p-3 text-left transition",
                isActive
                  ? "border-white/20 bg-white/14 shadow-[0_16px_32px_rgba(8,20,16,0.16)]"
                  : "border-white/10 bg-white/6 text-white/68 hover:border-white/18 hover:bg-white/10"
              )}
            >
              <div className="text-[11px] uppercase tracking-[0.28em] text-white/46">{slide.eyebrow}</div>
              <div className="mt-2 text-sm font-medium leading-6">{slide.title}</div>
              <div className="mt-3 h-1 rounded-full bg-white/10">
                <div
                  className={cn("h-full rounded-full bg-amberleaf transition-all duration-500", isActive ? "w-full" : "w-0")}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
