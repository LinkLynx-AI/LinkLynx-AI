"use client";

import { useState } from "react";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Toggle } from "@/shared/ui/toggle";
import { Select } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";

const slowModeOptions = [
  { value: "0", label: "オフ" },
  { value: "5", label: "5秒" },
  { value: "10", label: "10秒" },
  { value: "15", label: "15秒" },
  { value: "30", label: "30秒" },
  { value: "60", label: "60秒" },
];

export function ChannelEditOverview({ channelId }: { channelId?: string }) {
  const [name, setName] = useState("general");
  const [topic, setTopic] = useState("");
  const [nsfw, setNsfw] = useState(false);
  const [slowMode, setSlowMode] = useState("0");

  const handleSave = () => {
    // Future: save channel settings via API
  };

  return (
    <div className="space-y-6">
      <Input
        label="チャンネル名"
        value={name}
        onChange={(e) => setName(e.target.value)}
        fullWidth
      />
      <Textarea
        label="トピック"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="チャンネルのトピックを入力..."
        fullWidth
      />
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-discord-text-normal">年齢制限チャンネル</div>
          <div className="text-xs text-discord-text-muted">
            このチャンネルをNSFWに設定すると、年齢確認が必要になります
          </div>
        </div>
        <Toggle checked={nsfw} onChange={setNsfw} />
      </div>
      <div>
        <label className="mb-2 block text-xs font-bold uppercase text-discord-header-secondary">
          スローモード
        </label>
        <Select
          options={slowModeOptions}
          value={slowMode}
          onChange={setSlowMode}
          className="w-full"
        />
        <p className="mt-1 text-xs text-discord-text-muted">
          メンバーがこのチャンネルでメッセージを送信できる頻度を制限します
        </p>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave}>変更を保存</Button>
      </div>
    </div>
  );
}
