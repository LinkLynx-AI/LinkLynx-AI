type ToastVariant = "info" | "success" | "warning" | "error";

type ToastProps = {
  title: string;
  description?: string;
  variant?: ToastVariant;
};

const variantClassMap: Record<ToastVariant, string> = {
  info: "border-discord-primary bg-discord-primary/10",
  success: "border-discord-green bg-discord-green/10",
  warning: "border-discord-yellow bg-discord-yellow/10",
  error: "border-discord-red bg-discord-red/10",
};

export function Toast({ title, description, variant = "info" }: ToastProps) {
  return (
    <article
      role="status"
      className={`rounded-lg border px-4 py-3 text-sm text-white shadow-sm ${variantClassMap[variant]}`}
    >
      <p className="font-semibold">{title}</p>
      {description ? <p className="mt-1 text-white/75">{description}</p> : null}
    </article>
  );
}
