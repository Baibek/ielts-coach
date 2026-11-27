"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Clock, Headphones, Pause, Play, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/app/i18n-provider";
import { cn } from "@/lib/utils";
import type { Answers, Group } from "@/lib/tests/schema";
import { submitObjective } from "@/app/(app)/objective-actions";
import { QuestionGroups } from "./question-groups";
import { assignVoices, speakLine, voicesReady, type SpeakerInfo, type VoicePlan } from "./listening-voices";

export type TestView = {
  id: string;
  title: string;
  paragraphs?: Array<{ label: string; text: string }>;
  part?: number;
  speakers?: SpeakerInfo[];
  lines?: Array<{ speaker: string; text: string }>;
  groups: Group[];
};

type Props = {
  skill: "reading" | "listening";
  mode: "practice" | "timed" | "diagnostic";
  variant: "single" | "full";
  tests: TestView[];
  timeLimitSec: number | null;
  mockId?: string;
};

function mmss(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function readDraft(key: string): Answers {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}") as Answers;
  } catch {
    return {};
  }
}

export function ObjectiveTest({ skill, mode, variant, tests, timeLimitSec, mockId }: Props) {
  const { t } = useI18n();
  const draftKey = `ielts:obj:${skill}:${tests.map((x) => x.id).join("+")}`;
  const allNumbers = useMemo(() => tests.flatMap((x) => x.groups.flatMap((g) => g.questions.map((q) => q.n))), [tests]);
  const [answers, setAnswers] = useState<Answers>({});
  const [tab, setTab] = useState(0);
  const [pane, setPane] = useState<"text" | "questions">("text");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [pending, start] = useTransition();
  const [submitError, setSubmitError] = useState(false);
  const submitted = useRef(false);
  const examLike = mode !== "practice";

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- restore draft from browser storage after mount */
    setAnswers(readDraft(draftKey));
    setStartedAt(Date.now());
    setNow(Date.now());
    /* eslint-enable react-hooks/set-state-in-effect */
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [draftKey]);

  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  const remaining = timeLimitSec ? timeLimitSec - elapsed : null;

  const setAnswer = useCallback(
    (n: number, v: string) =>
      setAnswers((a) => {
        const next = { ...a, [n]: v };
        try {
          localStorage.setItem(draftKey, JSON.stringify(next));
        } catch {
          /* draft not kept */
        }
        return next;
      }),
    [draftKey],
  );

  const submit = useCallback(
    (force: boolean) => {
      if (submitted.current) return;
      const blanks = allNumbers.filter((n) => !answers[n]?.trim()).length;
      if (!force && blanks > 0 && !window.confirm(t("obj.confirmBlank", { n: blanks }))) return;
      submitted.current = true;
      window.speechSynthesis?.cancel();
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* ignore */
      }
      setSubmitError(false);
      start(async () => {
        try {
          const res = await submitObjective({
            skill, mode, variant, testIds: tests.map((x) => x.id), answers: Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v])),
            durationSec: Math.round(elapsed),
            mockId,
          });
          if (res?.error) {
            submitted.current = false;
            setSubmitError(true);
          }
        } catch (e) {
          if (String(e).includes("NEXT_REDIRECT")) throw e;
          submitted.current = false;
          setSubmitError(true);
        }
      });
    },
    [allNumbers, answers, draftKey, elapsed, mockId, mode, skill, t, tests, variant],
  );

  // Time limit: submit automatically, like the computer-delivered test.
  const submitRef = useRef(submit);
  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);
  useEffect(() => {
    if (!timeLimitSec || !startedAt) return;
    const id = setInterval(() => {
      if ((Date.now() - startedAt) / 1000 >= timeLimitSec) submitRef.current(true);
    }, 1000);
    return () => clearInterval(id);
  }, [timeLimitSec, startedAt]);

  const answeredCount = allNumbers.filter((n) => answers[n]?.trim()).length;
  const current = tests[tab];

  function jump(n: number) {
    const ti = tests.findIndex((x) => x.groups.some((g) => g.questions.some((q) => q.n === n)));
    if (ti >= 0) setTab(ti);
    setPane("questions");
    setTimeout(() => document.querySelector<HTMLElement>(`[data-q="${n}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  }

  return (
    <div className="flex flex-col gap-3" data-testid="objective-test">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-2 border-b bg-background/95 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <span className={cn("flex items-center gap-1.5 text-sm font-semibold tabular-nums", remaining !== null && remaining < 300 && "text-danger")} data-testid="obj-timer">
          <Clock className="size-4" /> {remaining !== null ? mmss(remaining) : mmss(elapsed)}
        </span>
        <span className="text-xs text-muted-foreground tabular-nums">{answeredCount}/{allNumbers.length}</span>
        <Button size="sm" className="ml-auto" onClick={() => submit(false)} disabled={pending}>
          <Send /> {pending ? t("obj.submitting") : t("obj.submit")}
        </Button>
      </div>
      {submitError && <p role="alert" className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{t("common.error")}</p>}

      {skill === "listening" && (
        <ListeningPlayer tests={tests} examLike={examLike} onPartChange={setTab} onFinished={() => {}} reviewSec={variant === "full" ? 120 : 60} onAutoSubmit={() => submitRef.current(true)} />
      )}

      {tests.length > 1 && (
        <div className="flex gap-1 overflow-x-auto" role="tablist">
          {tests.map((x, i) => (
            <button key={x.id} role="tab" aria-selected={tab === i} onClick={() => setTab(i)}
              className={cn("whitespace-nowrap rounded-md border px-3 py-1.5 text-xs font-medium", tab === i ? "border-primary bg-accent text-accent-foreground" : "bg-card")}>
              {skill === "reading" ? t("obj.passage", { n: i + 1 }) : t("obj.partN", { n: x.part ?? i + 1 })}
            </button>
          ))}
        </div>
      )}

      {skill === "reading" ? (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-0.5 text-xs font-medium lg:hidden">
            {(["text", "questions"] as const).map((p) => (
              <button key={p} onClick={() => setPane(p)} className={cn("rounded-md py-1.5", pane === p ? "bg-accent text-accent-foreground" : "text-muted-foreground")}>
                {t(p === "text" ? "obj.text" : "obj.questions")}
              </button>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <article lang="en" className={cn("rounded-xl border bg-card p-4 lg:block lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto", pane === "text" ? "block" : "hidden")}>
              <h2 className="mb-3 text-lg font-semibold">{current.title}</h2>
              {current.paragraphs?.map((p) => (
                <p key={p.label} className="mb-3 text-[15px] leading-7"><b className="mr-2 text-muted-foreground">{p.label}</b>{p.text}</p>
              ))}
            </article>
            <div className={cn("rounded-xl border bg-card p-4 lg:block lg:max-h-[calc(100dvh-11rem)] lg:overflow-y-auto", pane === "questions" ? "block" : "hidden")}>
              <QuestionGroups groups={current.groups} answers={answers} onChange={setAnswer} disabled={pending} />
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-3 text-sm text-muted-foreground" lang="en">{current.title}</p>
          <QuestionGroups groups={current.groups} answers={answers} onChange={setAnswer} disabled={pending} />
        </div>
      )}

      <nav className="flex flex-wrap gap-1" aria-label={t("obj.questions")}>
        {allNumbers.map((n) => (
          <button key={n} onClick={() => jump(n)}
            className={cn("size-8 rounded-md border text-xs tabular-nums", answers[n]?.trim() ? "border-primary bg-accent text-accent-foreground" : "bg-card text-muted-foreground")}>
            {n}
          </button>
        ))}
      </nav>
    </div>
  );
}

function ListeningPlayer({
  tests, examLike, onPartChange, reviewSec, onAutoSubmit,
}: { tests: TestView[]; examLike: boolean; onPartChange: (i: number) => void; onFinished: () => void; reviewSec: number; onAutoSubmit: () => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<"idle" | "reading" | "playing" | "paused" | "done">("idle");
  const [part, setPart] = useState(0);
  const [line, setLine] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [rate, setRate] = useState(1);
  const [supported, setSupported] = useState(true);
  const run = useRef(0);
  const plans = useRef<Record<string, VoicePlan>[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- capability is only known in the browser
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    const runRef = run;
    return () => {
      runRef.current++;
      window.speechSynthesis?.cancel();
    };
  }, []);

  const wait = (sec: number, id: number) =>
    new Promise<boolean>((resolve) => {
      let left = sec;
      setCountdown(left);
      const iv = setInterval(() => {
        if (run.current !== id) {
          clearInterval(iv);
          return resolve(false);
        }
        left -= 1;
        setCountdown(left);
        if (left <= 0) {
          clearInterval(iv);
          resolve(true);
        }
      }, 1000);
    });

  async function play(fromPart: number, fromLine: number) {
    const id = ++run.current;
    await voicesReady();
    plans.current = tests.map((x) => assignVoices(x.speakers ?? []));
    for (let p = fromPart; p < tests.length; p++) {
      setPart(p);
      onPartChange(p);
      const lines = tests[p].lines ?? [];
      let l0 = p === fromPart ? fromLine : 0;
      if (examLike && l0 === 0) {
        setState("reading");
        if (!(await wait(p === 0 ? 20 : 15, id))) return;
      }
      setState("playing");
      for (let l = l0; l < lines.length; l++) {
        if (run.current !== id) return;
        setLine(l);
        await speakLine(lines[l].text, plans.current[p][lines[l].speaker], examLike ? 1 : rate);
      }
      l0 = 0;
      if (!examLike) {
        setState("done");
        setLine(0);
        return;
      }
    }
    setState("done");
    if (examLike) {
      setState("reading");
      setCountdown(reviewSec);
      if (await wait(reviewSec, id)) onAutoSubmit();
    }
  }

  function pause() {
    run.current++;
    window.speechSynthesis?.cancel();
    setState("paused");
  }

  const total = tests[part]?.lines?.length ?? 0;
  if (!supported) return <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{t("obj.noTts")}</p>;

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3" data-testid="listening-player">
      <div className="flex flex-wrap items-center gap-2">
        <Headphones className="size-5 text-primary" />
        <span className="text-sm font-medium">{t("obj.partN", { n: tests[part]?.part ?? part + 1 })}</span>
        <span className="text-xs text-muted-foreground tabular-nums" data-testid="player-progress">{Math.min(line + 1, total)}/{total}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {examLike ? (
            state === "idle" && <Button size="sm" onClick={() => void play(0, 0)}><Play /> {t("obj.playOnce")}</Button>
          ) : (
            <>
              {state === "playing" ? (
                <Button size="sm" variant="outline" onClick={pause}><Pause /> {t("obj.pause")}</Button>
              ) : (
                <Button size="sm" onClick={() => void play(part, state === "paused" ? line : 0)}><Play /> {t("obj.play")}</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { pause(); setLine(0); setState("idle"); }} aria-label={t("obj.restart")}><RotateCcw /></Button>
              <select value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label={t("obj.speed")} className="h-8 rounded-md border border-input bg-card px-1 text-xs">
                <option value={0.85}>0.85×</option>
                <option value={1}>1×</option>
              </select>
            </>
          )}
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${total ? ((line + (state === "done" ? 1 : 0)) / total) * 100 : 0}%` }} />
      </div>
      {state === "reading" && <p className="text-xs font-medium text-primary" data-testid="player-countdown">{line === 0 && countdown > 0 && countdown <= 20 ? t("obj.readTime", { s: countdown }) : t("obj.reviewTime", { s: mmss(countdown) })}</p>}
      {state === "playing" && <p className="text-xs text-muted-foreground">{t("obj.playing")}</p>}
      <p className="text-[11px] text-muted-foreground">{t("obj.voiceNote")}</p>
    </div>
  );
}
