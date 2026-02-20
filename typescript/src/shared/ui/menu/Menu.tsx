type MenuItem = {
  id: string;
  label: string;
  disabled?: boolean;
  destructive?: boolean;
};

type MenuProps = {
  label: string;
  items: MenuItem[];
};

export function Menu({ label, items }: MenuProps) {
  return (
    <div className="w-72 rounded-lg border border-white/15 bg-discord-darker p-2 shadow-lg">
      <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-white/60">
        {label}
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              disabled={item.disabled}
              className={`w-full rounded-md px-3 py-2 text-left text-sm transition ${
                item.destructive
                  ? "text-discord-red hover:bg-discord-red/10"
                  : "text-white hover:bg-white/10"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
