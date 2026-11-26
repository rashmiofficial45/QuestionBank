"use client";

import { useEffect, useRef } from "react";
import { BarController, BarElement, CategoryScale, Chart, LinearScale, Tooltip } from "chart.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

export function ActivityChart({ data }: { data: { day: string; attempts: number }[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current) return;
    const chart = new Chart(canvas.current, {
      type: "bar",
      data: {
        labels: data.map(({ day }) => day),
        datasets: [{ label: "Attempts", data: data.map(({ attempts }) => attempts), backgroundColor: "#888888" }],
      },
      options: {
        animation: false, maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxTicksLimit: 6 } } },
      },
    });
    return () => chart.destroy();
  }, [data]);
  return <div className="h-44"><canvas ref={canvas} role="img" aria-label="Daily study attempts over the last 30 days. Exact values follow in a table." /></div>;
}
