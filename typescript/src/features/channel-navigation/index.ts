import type { Channel } from "@/shared/model/types/channel";

/**
 * テキストチャンネル一覧から遷移先候補を決定する。
 */
export function findFirstTextChannel(channels: Channel[]): Channel | null {
  const firstTextChannel = channels
    .filter((channel) => channel.type === 0)
    .sort((left, right) => left.position - right.position || left.id.localeCompare(right.id))[0];

  return firstTextChannel ?? null;
}
