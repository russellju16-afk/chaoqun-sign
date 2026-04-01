"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single stroke is a list of {x, y} points in canvas-coordinate space. */
type Point = { x: number; y: number };
type Stroke = Point[];

export interface SignaturePadHandle {
  /** Export the current signature as a PNG data URL. */
  toDataURL(): string;
  /** Returns true when no strokes have been drawn. */
  isEmpty(): boolean;
  /** Clear all strokes and reset the canvas. */
  clear(): void;
}

export interface SignaturePadProps {
  /** Called whenever the "has content" state changes. */
  onSignatureChange?: (isEmpty: boolean) => void;
  /** Extra Tailwind / CSS classes applied to the outer wrapper div. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CANVAS_HEIGHT = 200; // logical px
const LINE_WIDTH = 2.5;
const STROKE_COLOR = "#000000";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the CSS pixel ratio so retina canvases are sharp. */
function getDevicePixelRatio(): number {
  return typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
}

/** Scale a canvas to the physical pixel grid while keeping CSS size unchanged. */
function scaleCanvas(canvas: HTMLCanvasElement): void {
  const dpr = getDevicePixelRatio();
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.scale(dpr, dpr);
}

/** Get the canvas-coordinate position from a Touch. */
function touchToPoint(touch: Touch, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: touch.clientX - rect.left,
    y: touch.clientY - rect.top,
  };
}

/** Get the canvas-coordinate position from a MouseEvent. */
function mouseToPoint(e: MouseEvent, canvas: HTMLCanvasElement): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Draw a single stroke onto a 2D context. */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.length === 0) return;
  ctx.beginPath();
  ctx.lineWidth = LINE_WIDTH;
  ctx.strokeStyle = STROKE_COLOR;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.moveTo(stroke[0].x, stroke[0].y);

  if (stroke.length === 1) {
    // Single tap — draw a small dot so it is visible.
    ctx.arc(stroke[0].x, stroke[0].y, LINE_WIDTH / 2, 0, Math.PI * 2);
    ctx.fillStyle = STROKE_COLOR;
    ctx.fill();
    return;
  }

  for (let i = 1; i < stroke.length; i++) {
    ctx.lineTo(stroke[i].x, stroke[i].y);
  }
  ctx.stroke();
}

/** Redraw every stroke in history (used after undo and resize). */
function redrawAll(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = getDevicePixelRatio();
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad({ onSignatureChange, className = "" }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // All completed strokes for undo support.
    const strokesRef = useRef<Stroke[]>([]);
    // The stroke currently being drawn.
    const activeStrokeRef = useRef<Stroke | null>(null);
    // Whether a pointer is currently held down.
    const isDrawingRef = useRef(false);

    const [showPlaceholder, setShowPlaceholder] = useState(true);
    const [hasStrokes, setHasStrokes] = useState(false);

    // ------------------------------------------------------------------
    // Imperative handle
    // ------------------------------------------------------------------

    useImperativeHandle(ref, () => ({
      toDataURL() {
        return canvasRef.current?.toDataURL("image/png") ?? "";
      },
      isEmpty() {
        return strokesRef.current.length === 0;
      },
      clear() {
        handleClear();
      },
    }));

    // ------------------------------------------------------------------
    // Internal helpers
    // ------------------------------------------------------------------

    /** Notify parent and update local state. */
    const notifyChange = useCallback(
      (strokes: Stroke[]) => {
        const empty = strokes.length === 0;
        setHasStrokes(!empty);
        onSignatureChange?.(empty);
      },
      [onSignatureChange],
    );

    const handleClear = useCallback(() => {
      strokesRef.current = [];
      activeStrokeRef.current = null;
      isDrawingRef.current = false;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const dpr = getDevicePixelRatio();
          ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        }
      }
      setShowPlaceholder(true);
      notifyChange([]);
    }, [notifyChange]);

    const handleUndo = useCallback(() => {
      if (strokesRef.current.length === 0) return;
      strokesRef.current = strokesRef.current.slice(0, -1);
      const canvas = canvasRef.current;
      if (canvas) redrawAll(canvas, strokesRef.current);
      if (strokesRef.current.length === 0) setShowPlaceholder(true);
      notifyChange(strokesRef.current);
    }, [notifyChange]);

    // ------------------------------------------------------------------
    // Canvas initialisation + resize observer
    // ------------------------------------------------------------------

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Initial scale.
      scaleCanvas(canvas);

      const observer = new ResizeObserver(() => {
        scaleCanvas(canvas);
        redrawAll(canvas, strokesRef.current);
      });

      if (wrapperRef.current) observer.observe(wrapperRef.current);

      return () => observer.disconnect();
    }, []);

    // ------------------------------------------------------------------
    // Drawing logic (attached to the canvas element via useEffect so we
    // can call preventDefault on passive: false touch listeners).
    // ------------------------------------------------------------------

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // ---------- shared helpers ----------

      const startStroke = (pt: Point) => {
        isDrawingRef.current = true;
        activeStrokeRef.current = [pt];
        setShowPlaceholder(false);
      };

      const continueStroke = (pt: Point) => {
        if (!isDrawingRef.current || !activeStrokeRef.current) return;
        activeStrokeRef.current.push(pt);

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const pts = activeStrokeRef.current;
        const len = pts.length;

        // Draw only the newest segment for performance.
        ctx.beginPath();
        ctx.lineWidth = LINE_WIDTH;
        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        if (len >= 2) {
          ctx.moveTo(pts[len - 2].x, pts[len - 2].y);
          ctx.lineTo(pts[len - 1].x, pts[len - 1].y);
          ctx.stroke();
        }
      };

      const endStroke = () => {
        if (!isDrawingRef.current) return;
        isDrawingRef.current = false;
        if (activeStrokeRef.current && activeStrokeRef.current.length > 0) {
          // Handle single-point taps: draw the dot.
          if (activeStrokeRef.current.length === 1) {
            const ctx = canvas.getContext("2d");
            if (ctx) drawStroke(ctx, activeStrokeRef.current);
          }
          strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
          activeStrokeRef.current = null;
          notifyChange(strokesRef.current);
        }
      };

      // ---------- touch handlers ----------

      const onTouchStart = (e: TouchEvent) => {
        e.preventDefault(); // prevent scroll while drawing
        const touch = e.changedTouches[0];
        if (touch) startStroke(touchToPoint(touch, canvas));
      };

      const onTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        const touch = e.changedTouches[0];
        if (touch) continueStroke(touchToPoint(touch, canvas));
      };

      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        endStroke();
      };

      // ---------- mouse handlers ----------

      const onMouseDown = (e: MouseEvent) => {
        startStroke(mouseToPoint(e, canvas));
      };

      const onMouseMove = (e: MouseEvent) => {
        continueStroke(mouseToPoint(e, canvas));
      };

      const onMouseUp = () => endStroke();
      const onMouseLeave = () => endStroke();

      // Touch listeners must be { passive: false } so preventDefault works.
      canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", onTouchEnd, { passive: false });
      canvas.addEventListener("mousedown", onMouseDown);
      canvas.addEventListener("mousemove", onMouseMove);
      canvas.addEventListener("mouseup", onMouseUp);
      canvas.addEventListener("mouseleave", onMouseLeave);

      return () => {
        canvas.removeEventListener("touchstart", onTouchStart);
        canvas.removeEventListener("touchmove", onTouchMove);
        canvas.removeEventListener("touchend", onTouchEnd);
        canvas.removeEventListener("mousedown", onMouseDown);
        canvas.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("mouseup", onMouseUp);
        canvas.removeEventListener("mouseleave", onMouseLeave);
      };
    }, [notifyChange]);

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    return (
      <div className={`flex flex-col gap-2 ${className}`}>
        {/* Canvas wrapper */}
        <div
          ref={wrapperRef}
          className="relative w-full overflow-hidden rounded-lg bg-white"
          style={{ height: CANVAS_HEIGHT }}
        >
          {/* Dashed border — only visible when empty */}
          <div
            className={`pointer-events-none absolute inset-0 rounded-lg border-2 border-dashed transition-colors duration-200 ${
              hasStrokes ? "border-transparent" : "border-gray-300"
            }`}
          />

          {/* Placeholder label */}
          {showPlaceholder && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center select-none text-sm text-gray-400">
              请在此处签名
            </span>
          )}

          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-none cursor-crosshair"
            // width/height are set programmatically via scaleCanvas
          />
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!hasStrokes}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            撤销
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasStrokes}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清除
          </button>
        </div>
      </div>
    );
  },
);

export default SignaturePad;
