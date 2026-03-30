// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { render, screen, userEvent } from "@/test/test-utils";
import { ChannelEditModal } from "./channel-edit-modal";

vi.mock("./channel-edit-overview", () => ({
  ChannelEditOverview: () => <div>ChannelEditOverview</div>,
}));

vi.mock("./channel-edit-permissions", () => ({
  ChannelEditPermissions: () => <div>ChannelEditPermissions</div>,
}));

vi.mock("./channel-edit-invites", () => ({
  ChannelEditInvites: () => <div>ChannelEditInvites</div>,
}));

vi.mock("./channel-edit-integrations", () => ({
  ChannelEditIntegrations: () => <div>ChannelEditIntegrations</div>,
}));

describe("ChannelEditModal", () => {
  test("shows overview, permissions, invites, and integrations tabs", async () => {
    render(
      <ChannelEditModal
        onClose={vi.fn()}
        channelId="3001"
        channelName="general"
        channelType={0}
        serverId="2001"
      />,
    );

    expect(screen.getByRole("button", { name: "概要" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "権限" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "招待" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "連携" })).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "権限" }));

    expect(screen.getByText("ChannelEditPermissions")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "招待" }));

    expect(screen.getByText("ChannelEditInvites")).not.toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "連携" }));

    expect(screen.getByText("ChannelEditIntegrations")).not.toBeNull();
  });
});
