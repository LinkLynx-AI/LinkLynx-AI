"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  toast,
} from "@/shared/ui";

function PreviewButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      className="rounded-md border border-border bg-background px-4 py-2 text-sm text-foreground transition hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function CorePrimitivesPreview() {
  return (
    <section className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <PreviewButton>Dialog</PreviewButton>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Core Dialog</DialogTitle>
              <DialogDescription>shadcn + Radix のダイアログ土台です。</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <PreviewButton>Menu</PreviewButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>New Channel</DropdownMenuItem>
            <DropdownMenuItem>Invite Member</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover>
          <PopoverTrigger asChild>
            <PreviewButton>Popover</PreviewButton>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-sm text-muted-foreground">Popover の内容サンプルです。</p>
          </PopoverContent>
        </Popover>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <PreviewButton>Tooltip</PreviewButton>
            </TooltipTrigger>
            <TooltipContent>Tooltip の内容</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <PreviewButton onClick={() => toast("Toast sample", { description: "通知UIの接続確認" })}>
          Toast
        </PreviewButton>
      </div>

      <Tabs defaultValue="channels" className="w-full">
        <TabsList>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="channels" className="text-sm text-muted-foreground">
          チャンネル一覧のプレースホルダ
        </TabsContent>
        <TabsContent value="settings" className="text-sm text-muted-foreground">
          設定画面のプレースホルダ
        </TabsContent>
      </Tabs>
    </section>
  );
}
