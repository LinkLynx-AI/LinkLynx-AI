import { useQueryClient } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { Providers } from "./index";

function QueryClientProbe() {
  const queryClient = useQueryClient();
  const staleTime = queryClient.getDefaultOptions().queries?.staleTime;

  return <span data-stale-time={String(staleTime ?? "")}>probe</span>;
}

describe("Providers", () => {
  test("子要素を描画する", () => {
    const html = renderToStaticMarkup(
      <Providers>
        <p>child</p>
      </Providers>,
    );

    expect(html).toContain("child");
  });

  test("QueryClient のデフォルト staleTime を設定する", () => {
    const html = renderToStaticMarkup(
      <Providers>
        <QueryClientProbe />
      </Providers>,
    );

    expect(html).toContain('data-stale-time="60000"');
  });
});
