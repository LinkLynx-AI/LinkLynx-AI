"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

const DAY_HEADERS = ["日", "月", "火", "水", "木", "金", "土"];

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function CalendarPicker({
  selectedDate,
  onSelect,
  onClose,
  minDate,
  maxDate,
}: {
  selectedDate?: Date;
  onSelect: (date: Date) => void;
  onClose?: () => void;
  minDate?: Date;
  maxDate?: Date;
}) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(
    selectedDate?.getFullYear() ?? today.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(
    selectedDate?.getMonth() ?? today.getMonth()
  );

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const isDisabled = (day: number) => {
    const date = new Date(viewYear, viewMonth, day);
    if (minDate && date < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) {
      return true;
    }
    if (maxDate && date > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) {
      return true;
    }
    return false;
  };

  const handleSelect = (day: number) => {
    if (isDisabled(day)) return;
    onSelect(new Date(viewYear, viewMonth, day));
    onClose?.();
  };

  // Build 6 rows of 7 cells
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length < 42) cells.push(null);

  return (
    <div className="w-64 rounded-lg bg-discord-bg-floating p-3 shadow-lg">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="rounded p-1 text-discord-interactive-normal hover:text-discord-interactive-hover"
          aria-label="前の月"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-discord-text-normal">
          {viewYear}年{viewMonth + 1}月
        </span>
        <button
          onClick={nextMonth}
          className="rounded p-1 text-discord-interactive-normal hover:text-discord-interactive-hover"
          aria-label="次の月"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="mb-1 grid grid-cols-7 text-center">
        {DAY_HEADERS.map((d) => (
          <span
            key={d}
            className="text-xs font-medium text-discord-text-muted"
          >
            {d}
          </span>
        ))}
      </div>

      {/* Date grid */}
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {cells.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} className="h-8" />;
          }

          const date = new Date(viewYear, viewMonth, day);
          const isToday = isSameDay(date, today);
          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const disabled = isDisabled(day);

          return (
            <button
              key={day}
              onClick={() => handleSelect(day)}
              disabled={disabled}
              className={cn(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors",
                disabled
                  ? "cursor-not-allowed text-discord-text-muted/40"
                  : "text-discord-text-normal hover:bg-discord-bg-modifier-hover",
                isSelected &&
                  !disabled &&
                  "bg-discord-brand-blurple text-white hover:bg-discord-brand-blurple",
                isToday &&
                  !isSelected &&
                  !disabled &&
                  "ring-1 ring-discord-text-muted"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
