"use client";

import { useState } from "react";
import { Camera } from "lucide-react";
import { cn } from "@/shared/lib/legacy/cn";
import { Button } from "@/shared/ui/legacy/button";
import { Select } from "@/shared/ui/legacy/select";
import { Toggle } from "@/shared/ui/legacy/toggle";
import { Slider } from "@/shared/ui/legacy/slider";
import { KeybindRecorder } from "@/shared/ui/legacy/keybind-recorder";

const inputDevices = [
  { value: "default", label: "デフォルト - マイク (Realtek Audio)" },
  { value: "headset", label: "ヘッドセット マイク (USB Audio)" },
  { value: "webcam", label: "ウェブカメラ マイク (HD Camera)" },
];

const outputDevices = [
  { value: "default", label: "デフォルト - スピーカー (Realtek Audio)" },
  { value: "headphone", label: "ヘッドフォン (USB Audio)" },
  { value: "monitor", label: "モニタースピーカー (HDMI)" },
];

const cameraDevices = [
  { value: "default", label: "HD Webcam C920" },
  { value: "obs", label: "OBS Virtual Camera" },
];

type NoiseSuppression = "krisp" | "standard" | "none";

export function UserVoiceVideo() {
  const [inputDevice, setInputDevice] = useState("default");
  const [outputDevice, setOutputDevice] = useState("default");
  const [inputVolume, setInputVolume] = useState(100);
  const [outputVolume, setOutputVolume] = useState(100);
  const [isTesting, setIsTesting] = useState(false);
  const [noiseSuppression, setNoiseSuppression] = useState<NoiseSuppression>("krisp");
  const [echoCancellation, setEchoCancellation] = useState(true);
  const [pushToTalk, setPushToTalk] = useState(false);
  const [pttKey, setPttKey] = useState("");
  const [camera, setCamera] = useState("default");

  return (
    <div className="pb-20">
      <h2 className="mb-5 text-xl font-bold text-discord-header-primary">音声・ビデオ</h2>

      {/* Input Device */}
      <section className="mb-6">
        <h3 className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
          入力デバイス
        </h3>
        <Select
          options={inputDevices}
          value={inputDevice}
          onChange={setInputDevice}
          className="max-w-md"
        />
      </section>

      {/* Input Volume */}
      <section className="mb-6">
        <Slider
          label="入力音量"
          min={0}
          max={200}
          step={1}
          value={inputVolume}
          onChange={setInputVolume}
          showValue
          formatValue={(v) => `${v}%`}
        />
      </section>

      {/* Output Device */}
      <section className="mb-6">
        <h3 className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
          出力デバイス
        </h3>
        <Select
          options={outputDevices}
          value={outputDevice}
          onChange={setOutputDevice}
          className="max-w-md"
        />
      </section>

      {/* Output Volume */}
      <section className="mb-6">
        <Slider
          label="出力音量"
          min={0}
          max={200}
          step={1}
          value={outputVolume}
          onChange={setOutputVolume}
          showValue
          formatValue={(v) => `${v}%`}
        />
      </section>

      {/* Mic Test */}
      <section className="mb-8 border-b border-discord-divider pb-8">
        <h3 className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">
          マイクテスト
        </h3>
        <Button
          variant={isTesting ? "danger" : "secondary"}
          onClick={() => setIsTesting(!isTesting)}
        >
          {isTesting ? "テスト停止" : "テスト開始"}
        </Button>
      </section>

      {/* Noise Suppression */}
      <section className="mb-6">
        <h3 className="mb-3 text-xs font-bold uppercase text-discord-header-secondary">
          ノイズ抑制
        </h3>
        <div className="flex gap-4" role="radiogroup" aria-label="ノイズ抑制">
          {[
            { id: "krisp" as const, label: "Krisp", desc: "高品質ノイズ抑制" },
            { id: "standard" as const, label: "標準", desc: "基本的なノイズ抑制" },
            { id: "none" as const, label: "なし", desc: "ノイズ抑制を無効化" },
          ].map((opt) => (
            <button
              key={opt.id}
              role="radio"
              aria-checked={noiseSuppression === opt.id}
              onClick={() => setNoiseSuppression(opt.id)}
              className={cn(
                "flex flex-1 flex-col rounded-lg border-2 p-3 text-left transition-colors",
                noiseSuppression === opt.id
                  ? "border-discord-brand-blurple"
                  : "border-discord-interactive-muted hover:border-discord-interactive-normal",
              )}
            >
              <span className="text-sm font-medium text-discord-text-normal">{opt.label}</span>
              <span className="mt-1 text-xs text-discord-text-muted">{opt.desc}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Echo Cancellation */}
      <section className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-discord-text-normal">エコーキャンセル</h3>
          <p className="text-xs text-discord-text-muted">エコーやハウリングを自動的に低減します</p>
        </div>
        <Toggle checked={echoCancellation} onChange={setEchoCancellation} />
      </section>

      {/* Push-to-Talk */}
      <section className="mb-8 border-b border-discord-divider pb-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-discord-text-normal">Push-to-Talk</h3>
            <p className="text-xs text-discord-text-muted">
              キーを押している間だけマイクが有効になります
            </p>
          </div>
          <Toggle checked={pushToTalk} onChange={setPushToTalk} />
        </div>
        {pushToTalk && (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm text-discord-text-muted">ショートカット:</span>
            <KeybindRecorder value={pttKey} onChange={setPttKey} onClear={() => setPttKey("")} />
          </div>
        )}
      </section>

      {/* Camera */}
      <section className="mb-6">
        <h3 className="mb-2 text-xs font-bold uppercase text-discord-header-secondary">カメラ</h3>
        <Select
          options={cameraDevices}
          value={camera}
          onChange={setCamera}
          className="mb-4 max-w-md"
        />
        <div
          className="flex aspect-video max-w-md items-center justify-center rounded-lg bg-discord-bg-tertiary"
          aria-label="カメラプレビュー"
        >
          <Camera size={48} className="text-discord-interactive-muted" />
        </div>
      </section>
    </div>
  );
}
