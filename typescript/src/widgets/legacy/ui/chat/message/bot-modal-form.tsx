"use client";

import { useState } from "react";
import { cn } from "@/shared/lib/legacy/cn";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@/shared/ui/legacy/modal";
import { Button } from "@/shared/ui/legacy/button";
import type { BotModalForm as BotModalFormType, TextInputComponent } from "@/shared/model/legacy/types/bot-components";

function TextInput({
  component,
  value,
  onChange,
}: {
  component: TextInputComponent;
  value: string;
  onChange: (value: string) => void;
}) {
  const isShort = component.style === "short";

  return (
    <div className="mb-4">
      <label className="mb-2 flex items-center gap-1 text-xs font-bold uppercase text-discord-header-secondary">
        {component.label}
        {component.required && <span className="text-discord-btn-danger">*</span>}
      </label>
      {isShort ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={component.placeholder}
          maxLength={component.maxLength}
          className={cn(
            "w-full rounded-[3px] bg-discord-input-bg px-3 py-2 text-sm",
            "text-discord-text-normal placeholder:text-discord-text-muted",
            "outline-none focus:ring-1 focus:ring-discord-brand-blurple",
          )}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={component.placeholder}
          maxLength={component.maxLength}
          rows={4}
          className={cn(
            "w-full resize-none rounded-[3px] bg-discord-input-bg px-3 py-2 text-sm",
            "text-discord-text-normal placeholder:text-discord-text-muted",
            "outline-none focus:ring-1 focus:ring-discord-brand-blurple",
          )}
        />
      )}
    </div>
  );
}

export function BotModalFormDialog({
  form,
  open,
  onClose,
  onSubmit,
}: {
  form: BotModalFormType;
  open: boolean;
  onClose: () => void;
  onSubmit?: (customId: string, values: Record<string, string>) => void;
}) {
  const allInputs = form.components.flatMap((row) => row.components);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const input of allInputs) {
      initial[input.customId] = input.value ?? "";
    }
    return initial;
  });

  const handleSubmit = () => {
    const requiredMissing = allInputs.some(
      (input) => input.required && !values[input.customId]?.trim(),
    );
    if (requiredMissing) return;

    onSubmit?.(form.customId, values);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader>{form.title}</ModalHeader>
      <ModalBody>
        {allInputs.map((input) => (
          <TextInput
            key={input.customId}
            component={input}
            value={values[input.customId] ?? ""}
            onChange={(val) => setValues((prev) => ({ ...prev, [input.customId]: val }))}
          />
        ))}
      </ModalBody>
      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          キャンセル
        </Button>
        <Button onClick={handleSubmit}>送信</Button>
      </ModalFooter>
    </Modal>
  );
}
