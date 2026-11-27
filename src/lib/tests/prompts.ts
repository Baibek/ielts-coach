const QUESTION_RULES = `Question rules:
- Number questions consecutively from 1. Use the group types given. Every key must be checkable in the text.
- "explain.evidence": the exact sentence (or part of it) copied from the text that proves the answer; for NOT GIVEN, the closest related sentence.
- "explain.paraphrase": how the question wording maps to the text. "explain.trap": why a common wrong answer is tempting.
- "distractors": wrong options/answers that the text mentions on purpose.
Group shapes:
{"type":"tfng"|"ynng","instructions":"...","questions":[{"n":1,"text":"statement","answer":"TRUE|FALSE|NOT GIVEN (or YES|NO|NOT GIVEN)","explain":{...}}]}
{"type":"mcq","instructions":"Choose the correct letter, A, B, C or D.","questions":[{"n":1,"text":"question","options":[{"key":"A","text":"..."},...],"answer":"B","distractors":["C"],"explain":{...}}]}
{"type":"headings","instructions":"...","options":[{"key":"i","text":"heading"},...],"questions":[{"n":1,"text":"Paragraph B","answer":"iv","explain":{...}}]}  (2-3 more headings than paragraphs asked)
{"type":"match","instructions":"...","options":[{"key":"A","text":"..."},...],"questions":[{"n":1,"text":"statement","answer":"C","explain":{...}}]}
{"type":"completion","instructions":"Complete ... Choose NO MORE THAN TWO WORDS ...","wordLimit":2,"context":"text with gaps written as [[n]]","questions":[{"n":1,"answer":["exact words from the text","accepted variant"],"explain":{...}}]}`;

export const READING_SYSTEM = `You write original IELTS Academic Reading tests (never copy published Cambridge, IDP or British Council material).
Write one passage of 700-850 words in the style of a popular-science or academic magazine article, in 5-7 paragraphs labelled "A", "B", "C"..., then exactly 13 questions in 3 groups.
${QUESTION_RULES}
For completion, answers must be words copied exactly from the passage.
Output JSON only: {"title":"...","paragraphs":[{"label":"A","text":"..."}],"groups":[...]}`;

export function readingUser(topic: string, types: string[]): string {
  return `Topic: ${topic}. Use these three question group types in this order: ${types.join(", ")}. Make the questions as difficult as a real IELTS Academic test (band 6-7 level), with paraphrase rather than word matching.`;
}

const PART_BRIEF: Record<number, string> = {
  1: "Part 1: a conversation between two people in an everyday social situation (e.g. booking, enquiry, registration). 10 questions: one completion group (form or notes) with wordLimit 2 ('NO MORE THAN TWO WORDS AND/OR A NUMBER'). Include spelled names, numbers, dates, and at least three distractors (the speaker corrects or changes information).",
  2: "Part 2: a monologue in an everyday social context (e.g. a guide describing a facility or event). 10 questions: one mcq group (5 questions) and one map group (5 questions) where a map shows named landmarks plus unnamed places labelled \"A\"...\"H\"; options are A-H; question text is the name of the place to locate.",
  3: "Part 3: a conversation between two or three students (and maybe a tutor) about an assignment or study topic. 10 questions: one mcq group (5 questions) and one match group (5 questions, options A-F such as opinions or actions).",
  4: "Part 4: a university lecture monologue on an academic subject. 10 questions: one completion group (lecture notes) with wordLimit 1 ('ONE WORD ONLY').",
};

export const LISTENING_SYSTEM = `You write original IELTS Listening test sections (never copy published material). The script will be read aloud by text-to-speech, so write natural spoken English with fillers like "well" or "actually", but no stage directions.
${QUESTION_RULES}
- Answers must occur in the script in the same order as the questions. For completion the answer must appear word-for-word in the script.
- For a map group, add "map": {"kind":"map","title":"...","maps":[{"label":"Map","features":[{"name":"Car park","type":"car_park","x":0-100,"y":0-70,"w":number,"h":number}, {"name":"A","type":"building",...}]}]} with 8-11 non-overlapping features, 5-8 of them named with single letters.
Output JSON only: {"part":n,"title":"...","context":"one sentence describing the situation","speakers":[{"name":"...","gender":"male|female","accent":"GB|US|AU"}],"lines":[{"speaker":"name","text":"..."}],"groups":[...]}`;

export function listeningUser(part: number, topic: string): string {
  return `${PART_BRIEF[part]}\nTopic idea: ${topic}. Script length: ${part === 1 ? "450-550" : "550-700"} words. Use different accents for different speakers.`;
}

export const READING_TOPICS = [
  "urban beekeeping", "the history of glass-making", "sleep and memory in teenagers", "desert agriculture with seawater",
  "the psychology of queuing", "ancient trade routes across Central Asia", "coral reef restoration", "how languages borrow words",
  "the invention of standard time", "noise pollution and wildlife", "3D-printed houses", "the economics of free museums",
  "microplastics in soil", "the science of habit formation", "migration of steppe birds", "electric buses in cold climates",
];

export const LISTENING_TOPICS: Record<number, string[]> = {
  1: ["joining a sports centre", "renting a flat", "booking a language course", "reporting lost luggage", "ordering a birthday cake", "registering at a medical centre"],
  2: ["a guided tour of a new library", "a talk about a community garden", "information about a music festival site", "a museum audio guide", "an introduction to a wildlife park"],
  3: ["planning a group presentation on recycling", "discussing a survey about student diets", "feedback on a history essay", "choosing a topic for a marketing project"],
  4: ["the history of maps", "how bees communicate", "the economics of ride sharing", "ancient irrigation systems", "the psychology of colour in advertising"],
};

export const READING_TYPE_SETS: string[][] = [
  ["headings", "tfng", "completion"],
  ["mcq", "ynng", "match"],
  ["match", "tfng", "completion"],
  ["headings", "mcq", "completion"],
];
