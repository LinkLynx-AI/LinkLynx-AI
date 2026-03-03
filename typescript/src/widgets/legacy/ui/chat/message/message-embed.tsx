import { cn } from "@/shared/lib/legacy/cn";
import type { Embed } from "@/shared/model/legacy/types/message";

function numberToHex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function MessageEmbed({ embed }: { embed: Embed }) {
  const borderColor = embed.color ? numberToHex(embed.color) : "#202225";

  return (
    <div
      className="mt-1 flex max-w-[520px] rounded overflow-hidden bg-discord-bg-secondary"
      style={{ borderLeft: `4px solid ${borderColor}` }}
    >
      <div className="flex-1 px-4 py-2">
        {embed.author && (
          <div className="mb-1 flex items-center gap-2">
            {embed.author.iconUrl && (
              <img src={embed.author.iconUrl} alt="" className="h-6 w-6 rounded-full" />
            )}
            <span className="text-sm font-semibold text-discord-header-primary">
              {embed.author.url ? (
                <a
                  href={embed.author.url}
                  className="hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {embed.author.name}
                </a>
              ) : (
                embed.author.name
              )}
            </span>
          </div>
        )}

        {embed.title && (
          <div className="mb-1 text-base font-semibold text-discord-text-link">
            {embed.url ? (
              <a
                href={embed.url}
                className="hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                {embed.title}
              </a>
            ) : (
              embed.title
            )}
          </div>
        )}

        {embed.description && (
          <div className="mb-2 text-sm leading-[1.125rem] text-discord-text-normal">
            {embed.description}
          </div>
        )}

        {embed.fields && embed.fields.length > 0 && (
          <div className="mb-2 grid grid-cols-3 gap-2">
            {embed.fields.map((field, i) => (
              <div key={i} className={cn(field.inline ? "col-span-1" : "col-span-3")}>
                <div className="text-xs font-semibold text-discord-text-muted">{field.name}</div>
                <div className="text-sm text-discord-text-normal">{field.value}</div>
              </div>
            ))}
          </div>
        )}

        {embed.image && (
          <div className="mt-2">
            <img src={embed.image.url} alt="" className="max-h-[300px] max-w-full rounded" />
          </div>
        )}

        {(embed.footer || embed.timestamp) && (
          <div className="mt-2 flex items-center gap-1 text-xs text-discord-text-muted">
            {embed.footer?.iconUrl && (
              <img src={embed.footer.iconUrl} alt="" className="h-5 w-5 rounded-full" />
            )}
            {embed.footer?.text && <span>{embed.footer.text}</span>}
            {embed.footer?.text && embed.timestamp && <span> • </span>}
            {embed.timestamp && (
              <span>{new Date(embed.timestamp).toLocaleDateString("ja-JP")}</span>
            )}
          </div>
        )}
      </div>

      {embed.thumbnail && (
        <div className="flex-shrink-0 p-4">
          <img src={embed.thumbnail.url} alt="" className="h-20 w-20 rounded object-cover" />
        </div>
      )}
    </div>
  );
}
