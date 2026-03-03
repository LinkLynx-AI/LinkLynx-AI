type AuthLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
  footerText?: string;
  footerLinkText?: string;
  footerLinkHref?: string;
};

export function AuthLayout({
  title,
  description,
  children,
  footerText,
  footerLinkText,
  footerLinkHref,
}: AuthLayoutProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-discord-bg-tertiary px-4 py-10">
      <section className="w-full max-w-md rounded-lg bg-discord-bg-primary p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-discord-brand-blurple text-2xl font-bold text-white shadow-lg">
            L
          </div>
          <h1 className="text-2xl font-bold text-discord-header-primary">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-discord-text-muted">{description}</p>
          )}
        </div>

        <div>{children}</div>

        {footerText && footerLinkText && footerLinkHref && (
          <p className="mt-6 text-center text-sm text-discord-text-muted">
            {footerText}{" "}
            <a href={footerLinkHref} className="text-discord-text-link hover:underline">
              {footerLinkText}
            </a>
          </p>
        )}
      </section>
    </main>
  );
}
