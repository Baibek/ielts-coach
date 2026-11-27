"use client";

import { useState, useTransition } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { useI18n } from "@/components/app/i18n-provider";
import { AiErrorMessage } from "@/components/writing/ai-error";
import { addCard, addStarterDeck, deleteCard, generatePack } from "@/app/(app)/vocab/actions";

const TOPICS = ["education", "technology", "environment", "health", "work", "cities", "crime", "media", "travel", "science", "family", "government"];

export function AddCardForm() {
  const { t } = useI18n();
  const [word, setWord] = useState("");
  const [meaning, setMeaning] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addCard({ word, meaning });
          setMsg(r.error === "exists" ? t("vocab.exists") : r.error ? t("common.error") : t("vocab.added", { n: r.added ?? 0 }));
          if (!r.error) {
            setWord("");
            setMeaning("");
          }
        });
      }}
    >
      <Input value={word} onChange={(e) => setWord(e.target.value)} placeholder={t("vocab.word")} lang="en" required aria-label={t("vocab.word")} />
      <Input value={meaning} onChange={(e) => setMeaning(e.target.value)} placeholder={t("vocab.meaning")} aria-label={t("vocab.meaning")} />
      <Button type="submit" disabled={pending || !word.trim()} className="self-start"><Plus /> {pending ? t("common.saving") : t("vocab.addBtn")}</Button>
      {msg && <p className="text-xs text-muted-foreground" role="status">{msg}</p>}
    </form>
  );
}

export function PackForm() {
  const { t } = useI18n();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<{ code?: string; detail?: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label={t("vocab.pack")} className="w-auto">
          {TOPICS.map((x) => <option key={x} value={x}>{x}</option>)}
        </Select>
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setErr(null);
              const r = await generatePack(topic);
              if (r.error) setErr({ code: r.error, detail: r.detail });
              else setMsg(t("vocab.added", { n: r.added ?? 0 }));
            })
          }
        >
          <Sparkles /> {pending ? t("writing.generating") : t("vocab.packBtn")}
        </Button>
      </div>
      {msg && <p className="text-xs text-muted-foreground" role="status">{msg}</p>}
      {err && <AiErrorMessage code={err.code} detail={err.detail} />}
    </div>
  );
}

export function StarterButton() {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <Button variant="subtle" disabled={pending} onClick={() => start(async () => void (await addStarterDeck()))}>
      <Plus /> {t("vocab.starter")}
    </Button>
  );
}

export function DeleteCardButton({ id }: { id: string }) {
  const { t } = useI18n();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => deleteCard(id))} aria-label={t("common.delete")} className="rounded p-1 text-muted-foreground hover:text-danger">
      <Trash2 className="size-4" />
    </button>
  );
}
