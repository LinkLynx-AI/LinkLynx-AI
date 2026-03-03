"use client";

import { cn } from "@/lib/cn";

export function Slider({
  min,
  max,
  step = 1,
  value,
  onChange,
  label,
  showValue,
  formatValue,
  className,
  disabled,
}: {
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
  showValue?: boolean;
  formatValue?: (v: number) => string;
  className?: string;
  disabled?: boolean;
}) {
  const displayValue = formatValue ? formatValue(value) : String(value);

  return (
    <div className={cn("w-full", className)}>
      {label && (
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          {label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <span className="min-w-[32px] text-xs text-discord-text-muted">
          {formatValue ? formatValue(min) : min}
        </span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className={cn(
            "flex-1 accent-discord-brand-blurple",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={displayValue}
        />
        <span className="min-w-[32px] text-xs text-discord-text-muted">
          {formatValue ? formatValue(max) : max}
        </span>
        {showValue && (
          <span className="min-w-[40px] text-right text-sm text-discord-text-normal">
            {displayValue}
          </span>
        )}
      </div>
    </div>
  );
}
