import { Menu, Modal, Skeleton, Toast } from "@/shared/ui";

const menuItems = [
  { id: "edit", label: "編集" },
  { id: "pin", label: "固定" },
  { id: "archive", label: "アーカイブ", disabled: true },
  { id: "delete", label: "削除", destructive: true },
];

export default function Home() {
  return (
    <main className="relative min-h-screen bg-discord-darkest px-6 py-10 text-white">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-discord-primary">
            Common UI Components Preview
          </h1>
          <p className="text-sm text-white/75">
            Modal / Toast / Menu / Skeleton の外観と状態を共通化したサンプルです。
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <Toast
            title="保存しました"
            description="通知デザインを共通化して複数画面で再利用できます。"
            variant="success"
          />
          <Menu label="Action menu" items={menuItems} />
        </section>

        <section className="rounded-xl border border-white/10 bg-discord-darker p-4">
          <h2 className="mb-3 text-sm font-semibold text-white/80">Skeleton</h2>
          <Skeleton lines={4} />
        </section>
      </div>

      <Modal
        open
        title="Delete message"
        description="このメッセージを削除してもよろしいですか？"
        actions={
          <>
            <button
              type="button"
              className="rounded-md border border-white/20 px-3 py-1.5 text-sm text-white/70 transition hover:bg-white/10"
            >
              キャンセル
            </button>
            <button
              type="button"
              className="rounded-md bg-discord-red px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90"
            >
              削除する
            </button>
          </>
        }
      >
        この確認モーダルは再利用可能な見た目として統一されています。
      </Modal>
    </main>
  );
}
