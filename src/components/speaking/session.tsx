"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Mic, RotateCcw, Square, UserRound, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/components/app/i18n-provider";
import { AiErrorMessage } from "@/components/writing/ai-error";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { ScriptItem, SpeakingPart } from "@/lib/speaking/core";
import { finishSpeaking, saveSpeakingAnswer, startSpeaking } from "@/app/(app)/speaking/actions";
import { canSpeak, speak, stopSpeaking } from "./examiner-voice";
import { WavRecorder } from "./wav-recorder";

type Phase = "idle" | "starting" | "examiner" | "prep" | "ready" | "recording" | "review" | "finishing";
type Saved = { url: string; durationSec: number; status: "saving" | "saved" | "failed" };

function mmss(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Props = { sessionId: string; userId: string; part: SpeakingPart; mode: "practice" | "exam" | "diagnostic"; setIds: string[]; script: ScriptItem[]; mockId?: string };

export function SpeakingSession({ sessionId, userId, part, mode, setIds, script, mockId }: Props) {
  const { t } = useI18n();
  const examLike = mode !== "practice";
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [index, setIndex] = useState(0);
  const [prepLeft, setPrepLeft] = useState(60);
  const [recElapsed, setRecElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [notes, setNotes] = useState("");
  const [showText, setShowText] = useState(mode === "practice");
  const [saved, setSaved] = useState<Record<number, Saved>>({});
  const [error, setError] = useState<{ code?: string; detail?: string; message?: string } | null>(null);
  const [voiceOk, setVoiceOk] = useState(true);

  const recorder = useRef<WavRecorder | null>(null);
  const pending = useRef<Record<number, Promise<void>>>({});
  const recStart = useRef(0);
  const prepEnds = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  const indexRef = useRef(0);
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const item = script[index];
  const isLast = index === script.length - 1;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability is only known on the client
    setVoiceOk(canSpeak());
    return () => {
      stopSpeaking();
      recorder.current?.close();
    };
  }, []);

  const upload = useCallback(
    (i: number, blob: Blob, durationSec: number) => {
      const path = `${userId}/${sessionId}/${i}.wav`;
      const run = async () => {
        const supabase = createClient();
        const up = await supabase.storage.from("recordings").upload(path, blob, { upsert: true, contentType: "audio/wav" });
        if (up.error) throw new Error(up.error.message);
        const res = await saveSpeakingAnswer({ id: sessionId, index: i, path, durationSec });
        if (!res.ok) throw new Error(res.error ?? "save failed");
      };
      const prev = pending.current[i] ?? Promise.resolve();
      pending.current[i] = prev
        .catch(() => {})
        .then(run)
        .then(
          () => setSaved((s) => ({ ...s, [i]: { ...s[i], status: "saved" } })),
          () => setSaved((s) => ({ ...s, [i]: { ...s[i], status: "failed" } })),
        );
    },
    [sessionId, userId],
  );

  const finish = useCallback(async () => {
    phaseRef.current = "finishing";
    setPhase("finishing");
    stopSpeaking();
    await Promise.all(Object.values(pending.current));
    let res;
    try {
      res = await finishSpeaking(sessionId);
    } catch {
      res = { ok: false, error: "down" as const };
    }
    recorder.current?.close();
    const q = res.ok ? "" : `?error=${res.error ?? "generic"}${res.detail ? `&detail=${encodeURIComponent(res.detail)}` : ""}`;
    router.push(mockId ? "/mock" : `/speaking/${sessionId}${q}`);
  }, [mockId, router, sessionId]);

  const startRecording = useCallback(async () => {
    stopSpeaking();
    try {
      await recorder.current!.start();
    } catch {
      setError({ message: t("speaking.micDenied") });
      setPhase("ready");
      return;
    }
    recStart.current = performance.now();
    setRecElapsed(0);
    phaseRef.current = "recording";
    setPhase("recording");
  }, [t]);

  const runExaminer = useCallback(
    async (i: number) => {
      const it = script[i];
      setPhase("examiner");
      if (it.part === 2) {
        await speak(`${it.intro ?? ""} Here is your topic. ${it.question}`);
        if (indexRef.current !== i) return;
        prepEnds.current = Date.now() + (it.prepSec ?? 60) * 1000;
        setPrepLeft(it.prepSec ?? 60);
        setNotes("");
        phaseRef.current = "prep";
        setPhase("prep");
        return;
      }
      await speak([it.intro, it.question].filter(Boolean).join(" "));
      if (indexRef.current !== i || phaseRef.current !== "examiner") return;
      if (examLike) await startRecording();
      else setPhase("ready");
    },
    [examLike, script, startRecording],
  );

  const goTo = useCallback(
    (i: number) => {
      setIndex(i);
      indexRef.current = i;
      phaseRef.current = "examiner";
      setShowText(mode === "practice");
      void runExaminer(i);
    },
    [mode, runExaminer],
  );

  const stopRecording = useCallback(async () => {
    if (phaseRef.current !== "recording") return;
    phaseRef.current = "review";
    const i = indexRef.current;
    const rec = await recorder.current!.stop();
    setSaved((s) => {
      if (s[i]?.url) URL.revokeObjectURL(s[i].url);
      return { ...s, [i]: { url: URL.createObjectURL(rec.blob), durationSec: rec.durationSec, status: "saving" } };
    });
    upload(i, rec.blob, rec.durationSec);
    if (examLike) {
      if (i === script.length - 1) void finish();
      else goTo(i + 1);
    } else {
      setPhase("review");
    }
  }, [examLike, finish, goTo, script.length, upload]);

  // Timers: Part 2 preparation countdown and the recording clock / level meter.
  useEffect(() => {
    if (phase !== "prep" && phase !== "recording") return;
    const id = setInterval(() => {
      if (phaseRef.current === "prep") {
        const left = Math.ceil((prepEnds.current - Date.now()) / 1000);
        setPrepLeft(Math.max(0, left));
        if (left <= 0) {
          phaseRef.current = "examiner";
          setPhase("examiner");
          void speak("All right. Please start speaking now.").then(() => {
            if (phaseRef.current === "examiner") void startRecording();
          });
        }
      } else if (phaseRef.current === "recording") {
        const el = (performance.now() - recStart.current) / 1000;
        setRecElapsed(el);
        setLevel(recorder.current?.level ?? 0);
        if (el >= script[indexRef.current].maxSec) void stopRecording();
      }
    }, phase === "prep" ? 1000 : 150);
    return () => clearInterval(id);
  }, [phase, script, startRecording, stopRecording]);

  async function begin() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext ?? (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext)) {
      setError({ message: t("speaking.micUnsupported") });
      return;
    }
    setPhase("starting");
    recorder.current = new WavRecorder();
    try {
      await recorder.current.open();
    } catch {
      setError({ message: t("speaking.micDenied") });
      setPhase("idle");
      return;
    }
    const res = await startSpeaking({ id: sessionId, part, mode, setIds, mockId });
    if (!res.ok) {
      setError({ code: "generic" });
      setPhase("idle");
      return;
    }
    goTo(0);
  }

  // ---------- render ----------
  if (phase === "idle" || phase === "starting") {
    return (
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <p className="text-sm text-muted-foreground">{t("speaking.micHint")}</p>
        {!voiceOk && <p className="text-sm text-danger">{t("speaking.noVoice")}</p>}
        <ul className="flex flex-wrap gap-2 text-xs">
          {[...new Set(script.map((s) => s.part))].map((p) => (
            <Badge key={p}>{t("speaking.partN", { n: p })}</Badge>
          ))}
        </ul>
        {error && (error.message ? <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error.message}</p> : <AiErrorMessage code={error.code} detail={error.detail} />)}
        <Button size="lg" onClick={begin} disabled={phase === "starting"} className="self-start">
          {phase === "starting" ? <Loader2 className="animate-spin" /> : <Mic />} {t("speaking.start")}
        </Button>
      </div>
    );
  }

  if (phase === "finishing") {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-8 text-center" data-testid="speaking-finishing">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm">{t("speaking.analysing")}</p>
      </div>
    );
  }

  const cue = item.cue;
  const maxLeft = item.maxSec - recElapsed;

  return (
    <div className="flex flex-col gap-4" data-testid="speaking-session">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <Badge>{t("speaking.partN", { n: item.part })}</Badge>
        <span data-testid="question-counter">{t("speaking.questionN", { n: index + 1, total: script.length })}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((index + (phase === "review" ? 1 : 0)) / script.length) * 100}%` }} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground", phase === "examiner" && "animate-pulse")}>
            <UserRound className="size-5" />
          </span>
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium">{t("speaking.examiner")}</span>
            {phase === "examiner" && <span className="text-xs text-muted-foreground">{t("speaking.speakingNow")}</span>}
          </div>
          {voiceOk && phase !== "examiner" && phase !== "recording" && (
            <Button variant="ghost" size="sm" onClick={() => void speak(item.question)}>
              <Volume2 /> <span className="hidden sm:inline">{t("speaking.repeat")}</span>
            </Button>
          )}
        </div>
        {!cue &&
          (showText || !voiceOk ? (
            <p lang="en" className="text-lg font-medium" data-testid="question-text">{item.question}</p>
          ) : (
            <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowText(true)}>{t("speaking.showText")}</Button>
          ))}
        {cue && (
          <div lang="en" className="rounded-lg border-2 border-dashed border-primary/40 bg-muted/40 p-4" data-testid="cue-card">
            <p className="font-semibold">{cue.topic}</p>
            <p className="mt-2 text-sm">{t("speaking.youShouldSay")}</p>
            <ul className="mt-1 list-disc pl-5 text-sm">{cue.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
            <p className="mt-1 text-sm">{cue.final}</p>
          </div>
        )}
      </div>

      {phase === "prep" && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t("speaking.prep")}</span>
            <span className="text-2xl font-semibold tabular-nums" data-testid="prep-timer">{mmss(prepLeft)}</span>
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("speaking.prepHint")} lang="en"
            className="min-h-28 rounded-lg border border-input bg-background p-3 text-base" />
          <Button onClick={() => { phaseRef.current = "examiner"; setPrepLeft(0); void startRecording(); }}>{t("speaking.startTalking")}</Button>
        </div>
      )}

      {phase === "ready" && (
        <div className="flex flex-col items-center gap-3 py-2">
          {error?.message && <p role="alert" className="text-sm text-danger">{error.message}</p>}
          <button type="button" onClick={() => void startRecording()} aria-label={t("speaking.record")}
            className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90">
            <Mic className="size-8" />
          </button>
          <span className="text-sm font-medium">{t("speaking.record")}</span>
        </div>
      )}

      {phase === "recording" && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-danger/40 bg-card p-4" data-testid="recording">
          <div className="flex items-center gap-2 text-sm font-medium text-danger">
            <span className="size-2.5 animate-pulse rounded-full bg-danger" /> {t("speaking.recording")}
            <span className="tabular-nums">{mmss(recElapsed)}</span>
            <span className="text-muted-foreground">/ {mmss(item.maxSec)}</span>
          </div>
          <div className="h-2 w-48 overflow-hidden rounded-full bg-muted" aria-hidden>
            <div className="h-full rounded-full bg-success transition-[width] duration-150" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          {item.part === 2 && <p className="text-xs text-muted-foreground">{t("speaking.talkHint")}</p>}
          {maxLeft < 10 && <p className="text-xs text-danger tabular-nums">{mmss(maxLeft)}</p>}
          <Button variant="danger" onClick={() => void stopRecording()}><Square /> {t("speaking.stop")}</Button>
        </div>
      )}

      {phase === "review" && saved[index] && (
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4" data-testid="review">
          <audio controls src={saved[index].url} className="w-full" />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {saved[index].status === "saving" && <><Loader2 className="size-3.5 animate-spin" /> {t("speaking.saving")}</>}
            {saved[index].status === "saved" && <><CheckCircle2 className="size-3.5 text-success" /> {t("speaking.saved")}</>}
            {saved[index].status === "failed" && <span className="text-danger">{t("common.error")}</span>}
            <span className="ml-auto tabular-nums">{mmss(saved[index].durationSec)}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setPhase("ready")}><RotateCcw /> {t("speaking.rerecord")}</Button>
            <Button onClick={() => (isLast ? void finish() : goTo(index + 1))} className="flex-1">
              {isLast ? t("speaking.finish") : t("speaking.next")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
