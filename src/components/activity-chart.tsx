"use client";

import { useEffect, useRef } from "react";
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export function ActivityChart({ data }: { data: { day: string; attempts: number }[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const surface = canvas.current;
    if (!surface) return;
    const root = document.documentElement;
    const palette = () => {
      const styles = getComputedStyle(root);
      return { label: styles.getPropertyValue("--muted-foreground").trim(), grid: styles.getPropertyValue("--border").trim() };
    };
    const draw = () => {
      const colors = palette();
      return new Chart(surface, {
        type: "bar",
        data: {
          labels: data.map(({ day }) => day),
          datasets: [{ label: "Attempts", data: data.map(({ attempts }) => attempts), backgroundColor: "#888888" }],
        },
        options: {
          animation: false, maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0, color: colors.label }, grid: { color: colors.grid } },
            x: { ticks: { maxTicksLimit: 6, color: colors.label }, grid: { color: colors.grid } },
          },
        },
      });
    };
    let chart = draw();
    const observer = new MutationObserver(() => {
      chart.destroy();
      chart = draw();
    });
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { observer.disconnect(); chart.destroy(); };
  }, [data]);
  return <div className="h-44"><canvas ref={canvas} role="img" aria-label="Daily study attempts over the last 30 days. Exact values follow in a table." /></div>;
}
