// eslint-disable-next-line import/no-internal-modules -- LIN-237: Next標準redirectを使うためnext/navigationが必須。期限: 2026-03-31
import { redirect } from "next/navigation";

export default function HomePage() {
  redirect("/login");
}
