"use client";

import { useEffect, useRef, useCallback } from "react";
import { useUIStore } from "@/stores/ui-store";
import { Toast } from "./toast";

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 5;

export function ToastContainer() {
  const toasts = useUIStore((s) => s.toasts);
  const removeToast = useUIStore((s) => s.removeToast);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  const startTimer = useCallback(
    (id: string) => {
      if (timersRef.current.has(id)) return;
      const timer = setTimeout(() => {
        removeToast(id);
        timersRef.current.delete(id);
      }, AUTO_DISMISS_MS);
      timersRef.current.set(id, timer);
    },
    [removeToast]
  );

  const pauseTimer = useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    const visibleToasts = toasts.slice(-MAX_VISIBLE);
    visibleToasts.forEach((toast) => startTimer(toast.id));

    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [toasts, startTimer]);

  const visibleToasts = toasts.slice(-MAX_VISIBLE);

  if (visibleToasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col-reverse gap-2"
      aria-live="polite"
    >
      {visibleToasts.map((toast) => (
        <div
          key={toast.id}
          onMouseEnter={() => pauseTimer(toast.id)}
          onMouseLeave={() => startTimer(toast.id)}
        >
          <Toast
            id={toast.id}
            message={toast.message}
            type={toast.type}
            onDismiss={removeToast}
          />
        </div>
      ))}
    </div>
  );
}
