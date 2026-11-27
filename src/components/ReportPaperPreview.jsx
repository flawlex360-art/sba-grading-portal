import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, Minimize2, FileText } from 'lucide-react';

/**
 * Canonical A4 paper width at 96 DPI (210mm ≈ 794px).
 * Rendering ReportCard / KgReportCard at its true paper width and scaling
 * proportionally on narrow screens ensures mobile teachers and admins see an
 * exact WYSIWYG ("What You See Is What You Print") preview with zero crushed
 * columns, zero overlapping metadata labels, and zero right-edge clipping.
 */
export const REPORT_PAPER_WIDTH_PX = 794;

export function computeReportPreviewMetrics(containerWidth, sheetHeight, zoomMode = 'fit') {
  const safeWidth = Number(containerWidth) || 0;
  const safeHeight = Number(sheetHeight) || 0;

  if (safeWidth <= 0 || safeWidth >= REPORT_PAPER_WIDTH_PX) {
    return {
      isScaled: false,
      fitScale: 1,
      effectiveScale: 1,
      scaledWidth: safeWidth || REPORT_PAPER_WIDTH_PX,
      scaledHeight: safeHeight,
    };
  }

  const fitScale = safeWidth / REPORT_PAPER_WIDTH_PX;
  const effectiveScale =
    zoomMode === 'zoom'
      ? Math.min(1, Math.max(0.78, fitScale * 1.75))
      : fitScale;

  return {
    isScaled: true,
    fitScale,
    effectiveScale,
    scaledWidth:
      zoomMode === 'fit'
        ? Math.round(REPORT_PAPER_WIDTH_PX * effectiveScale)
        : Math.ceil(REPORT_PAPER_WIDTH_PX * effectiveScale),
    scaledHeight: safeHeight > 0 ? Math.ceil(safeHeight * effectiveScale) : 0,
  };
}

export default function ReportPaperPreview({ children }) {
  const containerRef = useRef(null);
  const sheetRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [zoomMode, setZoomMode] = useState('fit'); // 'fit' | 'zoom'

  useEffect(() => {
    const containerEl = containerRef.current;
    const sheetEl = sheetRef.current;
    if (!containerEl) return undefined;

    let rafId = null;
    const syncMeasurements = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (containerRef.current) {
          const nextW = containerRef.current.clientWidth;
          setContainerWidth((prev) => (Math.abs(prev - nextW) <= 1 ? prev : nextW));
        }
        if (sheetRef.current) {
          const nextH = sheetRef.current.offsetHeight;
          setSheetHeight((prev) => (Math.abs(prev - nextH) <= 1 ? prev : nextH));
        }
      });
    };

    syncMeasurements();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncMeasurements);
      return () => {
        if (rafId !== null) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', syncMeasurements);
      };
    }

    const ro = new ResizeObserver(syncMeasurements);
    ro.observe(containerEl);
    if (sheetEl) {
      ro.observe(sheetEl);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  // Keep height synced when student/remarks content changes without recreating ResizeObserver
  useEffect(() => {
    if (sheetRef.current) {
      const nextH = sheetRef.current.offsetHeight;
      setSheetHeight((prev) => (Math.abs(prev - nextH) <= 1 ? prev : nextH));
    }
  });

  const { isScaled, effectiveScale, scaledWidth, scaledHeight } = computeReportPreviewMetrics(
    containerWidth,
    sheetHeight,
    zoomMode
  );

  return (
    <div ref={containerRef} className="w-full min-w-0 no-print space-y-2">
      {isScaled && (
        <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-zinc-100/90 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-[11px]">
          <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 font-semibold min-w-0">
            <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="truncate">Print Preview</span>
          </div>
          <div className="inline-flex items-center rounded-md bg-white dark:bg-zinc-950 p-0.5 border border-zinc-200 dark:border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={() => setZoomMode('fit')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                zoomMode === 'fit'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Minimize2 className="w-3 h-3" />
              Fit Screen
            </button>
            <button
              type="button"
              onClick={() => setZoomMode('zoom')}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold transition-colors ${
                zoomMode === 'zoom'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <ZoomIn className="w-3 h-3" />
              Zoom In
            </button>
          </div>
        </div>
      )}

      <div
        className={`w-full rounded-xl ${
          isScaled && zoomMode === 'zoom'
            ? 'overflow-x-auto pb-2 custom-scrollbar'
            : 'overflow-hidden'
        }`}
      >
        <div
          style={
            isScaled
              ? {
                  width: `${scaledWidth}px`,
                  height: scaledHeight > 0 ? `${scaledHeight}px` : 'auto',
                  position: 'relative',
                }
              : undefined
          }
        >
          <div
            ref={sheetRef}
            style={
              isScaled
                ? {
                    width: `${REPORT_PAPER_WIDTH_PX}px`,
                    minWidth: `${REPORT_PAPER_WIDTH_PX}px`,
                    transform: `scale(${effectiveScale})`,
                    transformOrigin: 'top left',
                  }
                : undefined
            }
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
