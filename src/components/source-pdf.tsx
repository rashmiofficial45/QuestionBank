"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";

type Region = { page: number; bounds: [number, number, number, number] };

export function SourcePdf({ url, sourcePage, questionNumber, sourceText, regions }: { url: string; sourcePage: number; questionNumber: number; sourceText: string; regions: Region[] }) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [problem, setProblem] = useState(false);
  const [page, setPage] = useState(sourcePage);
  const [zoom, setZoom] = useState(1);
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setPage(sourcePage);
  }, [sourcePage, questionNumber]);

  useEffect(() => {
    let loading: ReturnType<typeof import("pdfjs-dist")["getDocument"]> | undefined;
    let cancelled = false;
    async function load() {
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
      if (cancelled) return;
      GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      loading = getDocument({ url, disableAutoFetch: true, disableStream: true, enableXfa: false });
      const pdf = await loading.promise;
      if (!cancelled) setDocument(pdf);
    }
    load().catch(() => { if (!cancelled) setProblem(true); });
    return () => { cancelled = true; void loading?.destroy().catch(() => {}); };
  }, [url]);

  useEffect(() => {
    if (!document || !canvas.current || !width) return;
    let cancelled = false;
    let rendered: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined;
    const bitmap = canvas.current;
    const number = Math.max(1, Math.min(page, document.numPages));
    async function render() {
      const original = await document!.getPage(number);
      if (cancelled) return;
      const natural = original.getViewport({ scale: 1, rotation: 0 });
      const viewport = original.getViewport({ scale: Math.min(1200, width) / natural.width * zoom });
      const density = Math.min(window.devicePixelRatio || 1, 2, 2800 / Math.max(viewport.width, viewport.height));
      bitmap.width = Math.ceil(viewport.width * density);
      bitmap.height = Math.ceil(viewport.height * density);
      bitmap.style.width = `${viewport.width}px`;
      bitmap.style.height = `${viewport.height}px`;
      rendered = original.render({ canvas: bitmap, viewport, transform: [density, 0, 0, density, 0, 0] });
      await rendered.promise;
      if (cancelled) return;
      const context = bitmap.getContext("2d");
      if (!context) return;
      context.setTransform(density, 0, 0, density, 0, 0);
      context.fillStyle = "rgba(245, 190, 26, .20)";
      context.strokeStyle = "#8b5d00";
      context.lineWidth = 1.5;
      const matches = regions.filter((region) => region.page === number);
      if (!matches.length && number === sourcePage && sourceText) {
        const normalize = (text: string) => text.replace(/\s+/g, " ").trim().toLowerCase();
        const lead = normalize(sourceText).slice(0, 70);
        const { items } = await original.getTextContent();
        if (cancelled) return;
        const candidates = items.filter((item) => "str" in item).filter((item) => {
          const text = normalize(item.str).replace(/^\d+[.)]\s*/, "");
          return text.length > 16 && (lead.startsWith(text) || text.startsWith(lead));
        });
        if (candidates.length === 1) {
          const item = candidates[0];
          const [x, y] = [item.transform[4], item.transform[5]];
          const [left, top] = viewport.convertToViewportPoint(x, y + item.height);
          const [right, bottom] = viewport.convertToViewportPoint(x + item.width, y);
          context.fillRect(left, top, right - left, bottom - top);
          context.strokeRect(left, top, right - left, bottom - top);
        }
      }
      for (const { bounds: [left, top, right, bottom] } of matches) {
        const [x1, y1] = viewport.convertToViewportPoint(natural.viewBox[0] + left, natural.viewBox[3] - top);
        const [x2, y2] = viewport.convertToViewportPoint(natural.viewBox[0] + right, natural.viewBox[3] - bottom);
        context.fillRect(x1, y1, x2 - x1, y2 - y1);
        context.strokeRect(x1, y1, x2 - x1, y2 - y1);
      }
    }
    render().catch(() => { if (!cancelled) setProblem(true); });
    return () => { cancelled = true; rendered?.cancel(); };
  }, [document, page, regions, width, zoom, sourcePage, sourceText]);

  return <div className="grid gap-2">
    <div className="flex flex-wrap items-center gap-2" aria-label="PDF controls">
      <Button type="button" size="sm" variant="outline" disabled={!document || page <= 1} onClick={() => setPage(page - 1)}>Previous page</Button>
      <span className="text-xs tabular-nums" aria-live="polite">Page {page}{document ? ` of ${document.numPages}` : ""}</span>
      <Button type="button" size="sm" variant="outline" disabled={!document || page >= document.numPages} onClick={() => setPage(page + 1)}>Next page</Button>
      <Button type="button" size="sm" variant="outline" aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom(zoom - 0.25)}>−</Button>
      <Button type="button" size="sm" variant="outline" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(zoom + 0.25)}>+</Button>
    </div>
    {problem ? <p className="notice">The preview could not render this page. Use Open PDF to view the original.</p>
      : <div ref={container} className="max-h-[650px] min-w-0 overflow-auto rounded-md border bg-muted" tabIndex={0} role="region" aria-label="Scrollable original PDF preview">
        <canvas ref={canvas} role="img" aria-label={`Original paper, page ${page}`} />
      </div>}
  </div>;
}
