"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { PRESET_COLORS } from "@/shared/api/legacy/mock/data/roles";

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;

  return { h: h * 360, s: s * 100, v: v * 100 };
}

function hsvToHex(h: number, s: number, v: number): string {
  const sNorm = s / 100;
  const vNorm = v / 100;
  const c = vNorm * sNorm;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vNorm - c;

  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function RoleColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value);
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingSV = useRef(false);
  const draggingHue = useRef(false);

  useEffect(() => {
    const newHsv = hexToHsv(value);
    setHsv(newHsv);
    setHexInput(value);
  }, [value]);

  const updateFromSV = useCallback(
    (clientX: number, clientY: number) => {
      const rect = svRef.current?.getBoundingClientRect();
      if (!rect) return;
      const s = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const v = Math.max(0, Math.min(100, (1 - (clientY - rect.top) / rect.height) * 100));
      const newHsv = { ...hsv, s, v };
      setHsv(newHsv);
      const hex = hsvToHex(newHsv.h, s, v);
      setHexInput(hex);
      onChange(hex);
    },
    [hsv, onChange],
  );

  const updateFromHue = useCallback(
    (clientX: number) => {
      const rect = hueRef.current?.getBoundingClientRect();
      if (!rect) return;
      const h = Math.max(0, Math.min(360, ((clientX - rect.left) / rect.width) * 360));
      const newHsv = { ...hsv, h };
      setHsv(newHsv);
      const hex = hsvToHex(h, newHsv.s, newHsv.v);
      setHexInput(hex);
      onChange(hex);
    },
    [hsv, onChange],
  );

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingSV.current) updateFromSV(e.clientX, e.clientY);
      if (draggingHue.current) updateFromHue(e.clientX);
    };
    const handleMouseUp = () => {
      draggingSV.current = false;
      draggingHue.current = false;
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [updateFromSV, updateFromHue]);

  function handleHexInput(input: string) {
    setHexInput(input);
    const cleaned = input.startsWith("#") ? input : `#${input}`;
    if (/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
      setHsv(hexToHsv(cleaned));
      onChange(cleaned.toLowerCase());
    }
  }

  const hueColor = hsvToHex(hsv.h, 100, 100);

  return (
    <div className="w-full">
      {/* SV gradient square */}
      <div
        ref={svRef}
        className="relative h-40 w-full cursor-crosshair rounded"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hueColor})`,
        }}
        onMouseDown={(e) => {
          draggingSV.current = true;
          updateFromSV(e.clientX, e.clientY);
        }}
      >
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            backgroundColor: hsvToHex(hsv.h, hsv.s, hsv.v),
          }}
        />
      </div>

      {/* Hue slider */}
      <div
        ref={hueRef}
        className="relative mt-3 h-3 w-full cursor-pointer rounded"
        style={{
          background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
        }}
        onMouseDown={(e) => {
          draggingHue.current = true;
          updateFromHue(e.clientX);
        }}
      >
        <div
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            backgroundColor: hueColor,
          }}
        />
      </div>

      {/* Preset colors */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={cn(
              "h-6 w-6 rounded-full transition-transform",
              value === color &&
                "scale-110 ring-2 ring-white ring-offset-2 ring-offset-discord-bg-primary",
            )}
            style={{ backgroundColor: color }}
            aria-label={color}
          />
        ))}
      </div>

      {/* Bottom row: preview + hex input */}
      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-10 w-10 shrink-0 rounded border border-discord-divider"
          style={{ backgroundColor: hsvToHex(hsv.h, hsv.s, hsv.v) }}
        />
        <div className="flex items-center gap-1">
          <span className="text-sm text-discord-text-muted">#</span>
          <input
            type="text"
            value={hexInput.replace("#", "")}
            onChange={(e) => handleHexInput(e.target.value)}
            maxLength={6}
            className="h-8 w-20 rounded-[3px] bg-discord-input-bg px-2 text-sm text-discord-text-normal outline-none focus:outline-2 focus:outline-discord-brand-blurple"
          />
        </div>
      </div>
    </div>
  );
}
