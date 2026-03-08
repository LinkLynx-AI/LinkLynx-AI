type ModerationStatePlaceholderProps = {
  title: string;
  description: string;
};

export function ModerationStatePlaceholder({
  title,
  description,
}: ModerationStatePlaceholderProps) {
  return (
    <section className="w-full rounded-lg border border-discord-divider bg-discord-bg-secondary p-6">
      <h2 className="text-xl font-semibold text-discord-text-normal">{title}</h2>
      <p className="mt-2 text-sm text-discord-text-muted">{description}</p>
    </section>
  );
}
