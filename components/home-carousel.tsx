"use client";

import { useEffect, useState } from "react";

export function HomeCarousel({ slides }: { slides: Array<{ eyebrow: string; title: string; description: string }> }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  const current = slides[active];

  return (
    <div className="rounded-[1.9rem] border border-white/12 bg-white/10 p-5 backdrop-blur">
      <div className="text-sm uppercase tracking-[0.28em] text-white/58">{current.eyebrow}</div>
      <div className="mt-3 text-2xl font-semibold leading-tight text-white">{current.title}</div>
      <p className="mt-3 text-sm leading-7 text-white/75">{current.description}</p>
      <div className="mt-6 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`切换到第 ${index + 1} 张`}
            onClick={() => setActive(index)}
            className={`h-2 rounded-full transition-all ${index === active ? "w-10 bg-amberleaf" : "w-2 bg-white/35"}`}
          />
        ))}
      </div>
    </div>
  );
}