"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const BACKUP_CODES = [
  "A1B2-C3D4",
  "E5F6-G7H8",
  "J9K0-L1M2",
  "N3P4-Q5R6",
  "S7T8-U9V0",
  "W1X2-Y3Z4",
  "D5E6-F7G8",
  "H9J0-K1L2",
];

export function TwoFactorSetup({
  onComplete,
  onCancel,
}: {
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [step, setStep] = useState(1);
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleDigitChange = useCallback(
    (index: number, value: string) => {
      if (!/^\d?$/.test(value)) return;
      const next = [...digits];
      next[index] = value;
      setDigits(next);

      if (value && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [digits],
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const codeComplete = digits.every((d) => d.length === 1);

  const handleDownloadCodes = () => {
    const text = BACKUP_CODES.join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "discord-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-4 rounded-lg bg-discord-bg-tertiary p-6">
      {/* Step indicator */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                s <= step
                  ? "bg-discord-brand-blurple text-white"
                  : "bg-discord-bg-modifier-accent text-discord-text-muted"
              }`}
            >
              {s}
            </div>
            {s < 3 && (
              <div
                className={`h-0.5 w-8 ${
                  s < step ? "bg-discord-brand-blurple" : "bg-discord-bg-modifier-accent"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: QR code */}
      {step === 1 && (
        <div className="text-center">
          <h3 className="mb-2 text-lg font-bold text-discord-header-primary">認証アプリを設定</h3>
          <p className="mb-4 text-sm text-discord-text-muted">
            Google AuthenticatorやAuthyなどの認証アプリでこのQRコードをスキャンしてください。
          </p>
          {/* QR code placeholder */}
          <div className="mx-auto flex h-[180px] w-[180px] items-center justify-center rounded-lg bg-white">
            <div className="grid grid-cols-5 gap-1">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className={`h-6 w-6 ${
                    [0, 1, 2, 4, 5, 6, 10, 12, 14, 18, 20, 21, 22, 24].includes(i)
                      ? "bg-black"
                      : "bg-white"
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-discord-text-muted">手動入力キー: ABCD-EFGH-IJKL-MNOP</p>
        </div>
      )}

      {/* Step 2: Code input */}
      {step === 2 && (
        <div className="text-center">
          <h3 className="mb-2 text-lg font-bold text-discord-header-primary">認証コードを入力</h3>
          <p className="mb-6 text-sm text-discord-text-muted">
            認証アプリに表示されている6桁のコードを入力してください。
          </p>
          <div className="flex justify-center gap-2">
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="h-12 w-10 rounded-[3px] bg-discord-input-bg text-center text-lg font-bold text-discord-text-normal outline-none focus:outline-2 focus:outline-discord-brand-blurple"
                aria-label={`コード ${i + 1}桁目`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Step 3: Backup codes */}
      {step === 3 && (
        <div className="text-center">
          <h3 className="mb-2 text-lg font-bold text-discord-header-primary">バックアップコード</h3>
          <p className="mb-4 text-sm text-discord-text-muted">
            これらのコードは安全な場所に保管してください。認証アプリにアクセスできなくなった場合に使用できます。
          </p>
          <div className="mx-auto grid max-w-[280px] grid-cols-2 gap-2">
            {BACKUP_CODES.map((code) => (
              <div
                key={code}
                className="rounded bg-discord-bg-secondary px-3 py-2 font-mono text-sm text-discord-text-normal"
              >
                {code}
              </div>
            ))}
          </div>
          <button
            onClick={handleDownloadCodes}
            className="mt-4 inline-flex items-center gap-2 text-sm text-discord-text-link hover:underline"
          >
            <Download size={14} />
            コードをダウンロード
          </button>
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <Button variant="link" onClick={step === 1 ? onCancel : () => setStep(step - 1)}>
          {step === 1 ? "キャンセル" : "戻る"}
        </Button>
        {step < 3 ? (
          <Button
            variant="primary"
            disabled={step === 2 && !codeComplete}
            onClick={() => setStep(step + 1)}
          >
            次へ
          </Button>
        ) : (
          <Button variant="primary" onClick={onComplete}>
            完了
          </Button>
        )}
      </div>
    </div>
  );
}
