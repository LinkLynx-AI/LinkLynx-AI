import { ChannelsShell } from "@/widgets/channels-shell";

type ChannelsLayoutProps = Readonly<{
  children: React.ReactNode;
  me: React.ReactNode;
}>;

export default function ChannelsLayout({ children, me }: ChannelsLayoutProps) {
  return <ChannelsShell>{me ?? children}</ChannelsShell>;
}
