import { z } from "zod";

const FRONTEND_ENV_SCHEMA = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().trim().min(1),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().trim().min(1),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().trim().min(1),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().trim().min(1),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().trim().min(1),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().trim().min(1),
});

export type FrontendEnv = z.infer<typeof FRONTEND_ENV_SCHEMA>;

function formatFrontendEnvError(error: z.ZodError, context: string): string {
  const reasons = error.issues.map((issue) => {
    const path = issue.path.join(".");
    return `${path}: ${issue.message}`;
  });

  return `${context} env validation failed: ${reasons.join(", ")}`;
}

/**
 * フロントエンドで必要な環境変数契約を検証する。
 */
export function parseFrontendEnv(
  rawEnv: NodeJS.ProcessEnv,
  context = "frontend",
): FrontendEnv {
  const parsed = FRONTEND_ENV_SCHEMA.safeParse(rawEnv);
  if (!parsed.success) {
    throw new Error(formatFrontendEnvError(parsed.error, context));
  }

  return parsed.data;
}
