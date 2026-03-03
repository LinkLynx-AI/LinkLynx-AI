import type { Channel } from "@/shared/model/types/channel";

export type ServerPageDisplayState = "loading" | "error" | "redirect-or-idle" | "empty";

/**
 * チャンネル一覧から最初のテキストチャンネルを選択する。
 */
export function findFirstTextChannel(channels: Channel[]): Channel | null {
  const firstTextChannel = channels
    .filter((channel) => channel.type === 0)
    .sort((left, right) => left.position - right.position)[0];

  return firstTextChannel ?? null;
}

/**
 * サーバーページの表示状態を決定する。
 */
export function resolveServerPageDisplayState(params: {
  channels: Channel[] | undefined;
  isLoading: boolean;
  isError: boolean;
}): ServerPageDisplayState {
  if (params.channels !== undefined) {
    return findFirstTextChannel(params.channels) === null ? "empty" : "redirect-or-idle";
  }

  if (params.isLoading) {
    return "loading";
  }

  if (params.isError) {
    return "error";
  }

  return "redirect-or-idle";
}
