import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { InviteRoutePreview } from "./invite-route-preview";

describe("InviteRoutePreview", () => {
  test("valid state renders guild metadata and login CTA", () => {
    const html = renderToStaticMarkup(
      <InviteRoutePreview
        status="valid"
        title="LinkLynx Developers への招待です"
        description="ログインすると参加前の確認画面として利用できます。"
        inviteCode="DEVJOIN2026"
        guildName="LinkLynx Developers"
        expiresAt="2026-03-21T00:00:00Z"
        uses={2}
        maxUses={100}
        primaryAction={{ label: "ログイン", href: "/login" }}
        secondaryAction={{ label: "ホームへ戻る", href: "/" }}
      />,
    );

    expect(html).toContain("LinkLynx Developers");
    expect(html).toContain("DEVJOIN2026");
    expect(html).toContain("2 / 100 回使用済み");
    expect(html).toContain('href="/login"');
  });

  test("expired state renders expired label and fallback CTA", () => {
    const html = renderToStaticMarkup(
      <InviteRoutePreview
        status="expired"
        title="招待リンクの期限が切れています"
        description="新しい招待リンクを送ってもらってください。"
        inviteCode="EXPIRED2026"
        guildName={null}
        expiresAt={null}
        uses={null}
        maxUses={null}
        primaryAction={{ label: "ホームへ戻る", href: "/" }}
        secondaryAction={{ label: "ログイン", href: "/login" }}
      />,
    );

    expect(html).toContain("期限切れ");
    expect(html).toContain("EXPIRED2026");
    expect(html).toContain('href="/login"');
  });

  test("invalid state hides empty metadata blocks", () => {
    const html = renderToStaticMarkup(
      <InviteRoutePreview
        status="invalid"
        title="招待リンクが無効です"
        description="リンクが見つからないか、すでに利用できません。"
        inviteCode="INVALID2026"
        guildName={null}
        expiresAt={null}
        uses={null}
        maxUses={null}
        primaryAction={{ label: "ホームへ戻る", href: "/" }}
        secondaryAction={{ label: "ログイン", href: "/login" }}
      />,
    );

    expect(html).toContain("無効");
    expect(html).toContain("INVALID2026");
    expect(html).not.toContain("サーバー");
    expect(html).not.toContain("有効期限");
    expect(html).not.toContain("利用状況");
    expect(html).toContain('href="/login"');
  });

  test("unavailable state renders retry CTA and neutral label", () => {
    const html = renderToStaticMarkup(
      <InviteRoutePreview
        status="unavailable"
        title="現在、招待を確認できません"
        description="時間をおいて再試行してください。"
        inviteCode="RETRY2026"
        guildName={null}
        expiresAt={null}
        uses={null}
        maxUses={null}
        primaryAction={{ label: "もう一度試す", href: "/invite/RETRY2026" }}
        secondaryAction={{ label: "ホームへ戻る", href: "/" }}
      />,
    );

    expect(html).toContain("確認不能");
    expect(html).toContain("もう一度試す");
    expect(html).toContain('href="/invite/RETRY2026"');
  });
});
