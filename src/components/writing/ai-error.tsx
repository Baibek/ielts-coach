"use client";

import { useI18n } from "@/components/app/i18n-provider";
import type { MessageKey } from "@/lib/i18n";

const KEYS: Record<string, MessageKey> = {
  limit: "ai.limit",
  down: "ai.down",
  config: "ai.config",
  invalid: "ai.invalid",
  too_short: "writing.tooShort",
  generic: "common.error",
  bad_prompt: "common.error",
};

export function AiErrorMessage({ code }: { code: string | undefined }) {
  const { t } = useI18n();
  if (!code) return null;
  return (
    <p role="alert" data-testid="ai-error" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">
      {t(KEYS[code] ?? "common.error")}
    </p>
  );
}
