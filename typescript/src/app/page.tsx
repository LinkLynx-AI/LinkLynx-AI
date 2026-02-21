import { MemberAvatar, type Message } from "@/entities";
import { ThemeToggleButton } from "@/features";
import { AppShellFrame, MessageTimeline } from "@/widgets";

const demoMember = {
  id: "member-1",
  displayName: "LinkLynx Bot",
  statusLabel: "Online",
  avatarLabel: "LB",
};

const demoMessages: Message[] = [
  {
    id: "message-1",
    senderId: "member-1",
    senderName: "LinkLynx Bot",
    body: "デザイン反映完了です。メッセージ一覧UIを確認してください。",
    sentAt: "2025-01-01T10:00:00.000Z",
  },
  {
    id: "message-2",
    senderId: "member-1",
    senderName: "LinkLynx Bot",
    body: "同一送信者の5分以内連投は同じグループで表示します。",
    sentAt: "2025-01-01T10:03:00.000Z",
  },
  {
    id: "message-3",
    senderId: "member-2",
    senderName: "Design Reviewer",
    body: "了解しました。次はモバイル幅での余白も確認します。",
    sentAt: "2025-01-01T10:08:00.000Z",
  },
];

export default function Home() {
  return (
    <AppShellFrame
      headerSlot={
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-discord-primary">LinkLynx</h1>
          <ThemeToggleButton currentTheme="dark" disabled />
        </div>
      }
      sidebarSlot={
        <div className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/70">
            Members
          </h2>
          <MemberAvatar member={demoMember} />
        </div>
      }
      contentSlot={
        <MessageTimeline messages={demoMessages} />
      }
    />
  );
}
