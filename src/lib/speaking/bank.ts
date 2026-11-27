// Original speaking questions written for this app (not copied from published tests).

export type Part1Set = { id: string; part: 1; topic: string; questions: string[] };
export type CueCard = { topic: string; bullets: string[]; final: string };
export type Part2Set = { id: string; part: 2; cue: CueCard; p3Theme: string; p3: string[] };
export type SpeakingSet = Part1Set | Part2Set;

export const PART1_BANK: Part1Set[] = [
  { id: "s1-01", part: 1, topic: "your home town", questions: [
    "Where is your home town?", "What do you like most about it?", "Has it changed much since you were a child?", "Would you like to live there in the future? Why?" ] },
  { id: "s1-02", part: 1, topic: "work or studies", questions: [
    "Do you work or are you a student?", "Why did you choose that subject or job?", "What is the most difficult part of it?", "What would you like to do in the next five years?" ] },
  { id: "s1-03", part: 1, topic: "food", questions: [
    "What kind of food do you enjoy most?", "Do you prefer eating at home or in restaurants?", "Is there any food you disliked as a child but like now?", "How often do you cook for yourself?" ] },
  { id: "s1-04", part: 1, topic: "weather", questions: [
    "What's the weather usually like where you live?", "Which season do you like best? Why?", "Does the weather ever change your plans?", "Would you like to live somewhere with a different climate?" ] },
  { id: "s1-05", part: 1, topic: "music", questions: [
    "How often do you listen to music?", "What kind of music do you like?", "Did you learn to play an instrument at school?", "Do you prefer listening to music alone or with other people?" ] },
  { id: "s1-06", part: 1, topic: "reading", questions: [
    "Do you enjoy reading?", "What was the last book you read?", "Do you prefer paper books or e-books?", "Did your parents read to you when you were young?" ] },
  { id: "s1-07", part: 1, topic: "your phone", questions: [
    "How much time do you spend on your phone each day?", "What do you use it for most?", "Have you ever tried to use your phone less?", "What would be difficult if you didn't have a phone for a week?" ] },
  { id: "s1-08", part: 1, topic: "sport and exercise", questions: [
    "Do you do any sport?", "Was sport important at your school?", "Do you prefer watching sport or doing it?", "Is there a new sport you would like to try?" ] },
  { id: "s1-09", part: 1, topic: "friends", questions: [
    "How often do you meet your friends?", "What do you usually do together?", "Do you have a friend you have known for a long time?", "Is it easy to make new friends as an adult?" ] },
  { id: "s1-10", part: 1, topic: "travel", questions: [
    "Do you like travelling?", "Where did you go on your last trip?", "Do you prefer travelling alone or with others?", "Which country would you most like to visit?" ] },
  { id: "s1-11", part: 1, topic: "shopping", questions: [
    "Do you enjoy shopping?", "Do you prefer shopping online or in shops?", "What was the last thing you bought for yourself?", "Do you think people buy too many things nowadays?" ] },
  { id: "s1-12", part: 1, topic: "mornings", questions: [
    "Are you a morning person?", "What do you usually do in the morning?", "Has your morning routine changed in recent years?", "What would your perfect morning be like?" ] },
];

export const PART2_BANK: Part2Set[] = [
  { id: "s2-01", part: 2, cue: { topic: "Describe a skill you learned that took a long time to master.",
      bullets: ["what the skill is", "when and how you learned it", "what difficulties you had"], final: "and explain how you feel about this skill now." },
    p3Theme: "learning skills", p3: [
      "Which skills are most important for young people today?", "Is it better to learn a skill from a teacher or from the internet? Why?",
      "Why do some people give up when learning something new?", "How might the skills people need change in the future?" ] },
  { id: "s2-02", part: 2, cue: { topic: "Describe a place in your country that you would recommend to visitors.",
      bullets: ["where it is", "how you know about it", "what people can do there"], final: "and explain why you would recommend it." },
    p3Theme: "tourism", p3: [
      "What are the benefits of tourism for a country?", "Can tourism cause problems for local people?",
      "How has the way people travel changed in the last twenty years?", "Should famous places limit the number of visitors?" ] },
  { id: "s2-03", part: 2, cue: { topic: "Describe a person who has had an important influence on you.",
      bullets: ["who this person is", "how you know them", "what they did"], final: "and explain why this person influenced you so much." },
    p3Theme: "role models", p3: [
      "Who do young people look up to in your country?", "Do famous people have a responsibility to be good role models?",
      "Are parents more or less influential than they were in the past?", "How can teachers motivate their students?" ] },
  { id: "s2-04", part: 2, cue: { topic: "Describe a time when you helped someone.",
      bullets: ["who you helped", "what the situation was", "how you helped"], final: "and explain how you felt after helping." },
    p3Theme: "helping others", p3: [
      "Why do some people volunteer to help others for free?", "Should schools require students to do community work?",
      "Are people today less helpful than they used to be?", "What can governments do to encourage people to help their communities?" ] },
  { id: "s2-05", part: 2, cue: { topic: "Describe a piece of technology you find very useful.",
      bullets: ["what it is", "when you started using it", "how often you use it"], final: "and explain why it is so useful to you." },
    p3Theme: "technology", p3: [
      "How has technology changed the way people communicate?", "Do older people find it hard to use new technology? Why?",
      "Are there any disadvantages of relying too much on technology?", "What new technology do you think will be common in ten years?" ] },
  { id: "s2-06", part: 2, cue: { topic: "Describe a memorable celebration you attended.",
      bullets: ["what the celebration was", "where and when it took place", "who was there"], final: "and explain why it was memorable." },
    p3Theme: "celebrations and traditions", p3: [
      "Why are traditional celebrations important for a country?", "Are celebrations becoming more commercial?",
      "How do young people and older people celebrate differently?", "Should traditional festivals change with the times?" ] },
  { id: "s2-07", part: 2, cue: { topic: "Describe a goal you would like to achieve in the future.",
      bullets: ["what the goal is", "when you set this goal", "what you need to do to achieve it"], final: "and explain why this goal is important to you." },
    p3Theme: "ambition and success", p3: [
      "Is it important for young people to have clear goals?", "How do people define success in your culture?",
      "Does money bring happiness?", "Why do some people achieve their goals while others do not?" ] },
  { id: "s2-08", part: 2, cue: { topic: "Describe a book or film that made you think.",
      bullets: ["what it was", "when you read or watched it", "what it was about"], final: "and explain why it made you think." },
    p3Theme: "books and films", p3: [
      "Do people read less now than in the past?", "Should films based on real events be completely accurate?",
      "What can children learn from stories?", "Will cinemas still exist in the future?" ] },
  { id: "s2-09", part: 2, cue: { topic: "Describe an outdoor activity you enjoy.",
      bullets: ["what the activity is", "where you do it", "who you do it with"], final: "and explain why you enjoy it." },
    p3Theme: "nature and the outdoors", p3: [
      "Do children spend enough time outdoors nowadays?", "Why do people in cities want to spend time in nature?",
      "Should governments create more parks in cities?", "How can we protect natural areas from damage by visitors?" ] },
  { id: "s2-10", part: 2, cue: { topic: "Describe a time you had to make a difficult decision.",
      bullets: ["what the decision was", "when you made it", "what options you had"], final: "and explain how you feel about the decision now." },
    p3Theme: "decision-making", p3: [
      "Who usually makes important decisions in families in your country?", "Do young people today have too many choices?",
      "Is it better to make decisions quickly or slowly?", "Should teenagers be allowed to choose what they study at school?" ] },
];

export function findSpeakingSet(id: string): SpeakingSet | null {
  return [...PART1_BANK, ...PART2_BANK].find((s) => s.id === id) ?? null;
}
