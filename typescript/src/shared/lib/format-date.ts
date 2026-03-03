import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { ja } from "date-fns/locale";

export function formatMessageTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;

  if (isToday(d)) {
    return `今日 ${format(d, "HH:mm")}`;
  }
  if (isYesterday(d)) {
    return `昨日 ${format(d, "HH:mm")}`;
  }
  return format(d, "yyyy/MM/dd HH:mm");
}

export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: ja });
}

export function formatDateSeparator(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "yyyy年M月d日");
}

export function formatShortTimestamp(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return format(d, "HH:mm");
}
