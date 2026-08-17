"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import SignaturePadLib from "signature_pad";
import { FieldError } from "@/components/forms";

// signature_pad is imported ONLY here so the dependency stays out of the
// shared, dependency-free forms.tsx primitives.

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  /**
   * Accessible fallback: renders a typed name into the canvas as the signature
   * image. A <canvas> can't be drawn on with a keyboard or screen reader, and
   * the DB requires a signature image, so anyone who can't draw still needs a
   * real image — a typed name with clear intent to sign is a valid e-signature
   * under ESIGN/UETA. Returns false if there's nothing to render.
   */
  renderTypedName: (value: string) => boolean;
};

export function SignaturePad({
  name,
  error,
  onReady,
}: {
  name: string;
  error?: string;
  onReady?: (handle: SignaturePadHandle | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePadLib | null>(null);
  const hiddenRef = useRef<HTMLInputElement | null>(null);
  // Held in React state and rendered as a CONTROLLED hidden input: React 19
  // resets uncontrolled fields after a form action returns, which would clear
  // the signature while the drawing was still visibly on the canvas.
  const [dataUrl, setDataUrl] = useState("");
  const hasInk = dataUrl !== "";

  const errorId = error ? `${name}-error` : undefined;

  // Writes the DOM node directly as well as setting state. A state update is
  // async, so during submit it would land AFTER the browser has already
  // serialized the form — the value has to be in the DOM synchronously.
  const setSignature = useCallback((value: string) => {
    if (hiddenRef.current) hiddenRef.current.value = value;
    setDataUrl(value);
  }, []);

  const syncFromPad = useCallback(
    (empty: boolean) => {
      const pad = padRef.current;
      setSignature(empty || !pad ? "" : pad.toDataURL("image/png"));
    },
    [setSignature],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: "#ffffff", // opaque, so the stored PNG isn't transparent
      penColor: "#67686a", // brand grey
    });
    padRef.current = pad;

    // Retina/mobile: the backing store must be scaled to the device pixel
    // ratio or strokes render blurry and land offset from the finger. Resizing
    // clears the canvas, so preserve and restore any existing drawing.
    let lastWidth = 0;
    const resize = () => {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      // Skip while the element has no layout yet (hidden container, first
      // paint) — sizing off a ~0-width box produces a useless canvas.
      if (rect.width < 1) return;
      if (Math.abs(rect.width - lastWidth) < 1) return;
      lastWidth = rect.width;

      const data = pad.toData();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      pad.clear();
      if (data.length) pad.fromData(data);
    };

    resize();
    // Fires once the element actually gets laid out, and again on rotate or
    // window resize — covers what a one-shot measurement at mount misses.
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);

    const onEnd = () => syncFromPad(pad.isEmpty());
    pad.addEventListener("endStroke", onEnd);

    return () => {
      pad.removeEventListener("endStroke", onEnd);
      observer.disconnect();
      pad.off();
      padRef.current = null;
    };
  }, [syncFromPad]);

  // Registered in its own effect so the handle's identity doesn't depend on the
  // pad setup effect re-running.
  useEffect(() => {
    if (!onReady) return;
    onReady({
      isEmpty: () => padRef.current?.isEmpty() ?? true,
      renderTypedName: (value: string) => {
        const canvas = canvasRef.current;
        const pad = padRef.current;
        const text = value.trim();
        if (!canvas || !pad || !text) return false;

        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const width = canvas.width / ratio;
        const height = canvas.height / ratio;
        const ctx = canvas.getContext("2d");
        if (!ctx) return false;

        pad.clear(); // repaints the opaque background
        ctx.save();
        ctx.fillStyle = "#67686a";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        // Shrink to fit long names rather than overflowing the box.
        let size = 42;
        do {
          ctx.font = `italic ${size}px Arial, sans-serif`;
          size -= 3;
        } while (ctx.measureText(text).width > width * 0.9 && size > 15);
        ctx.fillText(text, width / 2, height / 2);
        ctx.restore();

        // Read straight off the canvas: pad.isEmpty() stays true for drawing
        // done via the canvas API, since signature_pad tracks only its own
        // strokes.
        setSignature(canvas.toDataURL("image/png"));
        return true;
      },
    });
    return () => onReady(null);
  }, [onReady, setSignature]);

  const clear = () => {
    padRef.current?.clear();
    syncFromPad(true);
  };

  return (
    <div className="mb-6">
      <p className="font-bold" id={`${name}-label`}>
        Sign here
      </p>
      <p className="mt-1 text-xs" id={`${name}-hint`}>
        Draw your signature in the box with your finger, trackpad, or mouse. If
        you can&apos;t draw one, just type your full legal name below and leave
        this box empty — we&apos;ll use your typed name as your signature.
      </p>
      <canvas
        ref={canvasRef}
        aria-labelledby={`${name}-label`}
        aria-describedby={`${name}-hint`}
        className={`mt-1 block h-36 w-full touch-none rounded-md border bg-white
          ${error ? "border-orange-dark" : "border-grey-tint1"}`}
      />
      <input ref={hiddenRef} type="hidden" name={name} value={dataUrl} />
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-grey-tint1 bg-white px-3 py-1 text-xs
            font-bold text-teal-dark hover:bg-grey-tint4 focus:outline-none
            focus-visible:ring-2 focus-visible:ring-teal-dark"
        >
          Clear signature
        </button>
        <span aria-live="polite" className="text-xs text-grey-tint1">
          {hasInk ? "Signature captured." : "Nothing drawn yet."}
        </span>
      </div>
      <FieldError id={errorId} message={error} />
    </div>
  );
}
