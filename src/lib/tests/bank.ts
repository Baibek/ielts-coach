// Original sample tests written for this app (no published IELTS material).
// They work without AI; everything else is AI-generated and cached.

import type { z } from "zod";
import type { ListeningPart, ReadingPassage } from "./schema";

type PassageIn = z.input<typeof ReadingPassage>;
type PartIn = z.input<typeof ListeningPart>;

export const READING_BANK: Array<{ id: string; passage: PassageIn }> = [
  {
    id: "r-01",
    passage: {
      title: "The Return of the Night Train",
      paragraphs: [
        { label: "A", text: "For much of the twentieth century, night trains were an ordinary way to travel across Europe. Passengers boarded in the evening, slept in narrow bunks and woke up in another country. By the early 2000s, however, many routes had disappeared. Cheap airlines offered tickets that were often less than half the price of a sleeper berth, and high-speed day trains reduced journey times between major cities. Railway companies, facing rising maintenance costs for old carriages, decided that night services were no longer worth keeping." },
        { label: "B", text: "The decline was not universal. In Austria, the national operator took the unusual step of buying several routes that German railways had abandoned in 2016. It renewed the brand, cleaned and refurbished the carriages and promoted the trains as a comfortable alternative to short flights. Within three years, passenger numbers on its overnight network had risen by roughly a third, and several new international connections were announced." },
        { label: "C", text: "Environmental concern is often given as the main reason for the revival. A seat on a night train produces a fraction of the carbon emissions of the same journey by air, and a growing number of travellers, particularly younger ones, say they choose rail for this reason. Yet researchers who have interviewed passengers suggest that convenience matters just as much. A train that leaves at nine in the evening and arrives in a city centre at seven the next morning saves the cost of a hotel and avoids the long security queues of an airport." },
        { label: "D", text: "Running night trains, however, remains difficult. Each sleeper carriage carries far fewer people than a day coach, because beds take up much more space than seats. Trains also have to pay fees for using the tracks of every country they cross, and these charges vary widely. In some countries the fee for a single night service is higher than the income from all the tickets sold on it. Staff costs are higher too, as attendants must work through the night." },
        { label: "E", text: "New companies have tried different approaches to these problems. One private operator leases old carriages instead of buying new ones, which allows it to start a route quickly and cheaply, although passengers sometimes complain about worn interiors. Another has designed compact sleeping pods, similar to those in capsule hotels, which fit more travellers into each carriage while still offering a private space. Whether such designs will prove popular with families and older travellers is not yet clear." },
        { label: "F", text: "Governments are now paying closer attention. The European Union has suggested that track fees for international trains could be reduced, and some countries already offer subsidies for night services that replace popular flight routes. Supporters argue that a well-connected sleeper network could become as normal as it was fifty years ago. Critics reply that, without a major change in the price of flying, night trains will remain a pleasant option for a minority of travellers rather than a real alternative." },
      ],
      groups: [
        {
          type: "headings",
          instructions: "Reading Passage has six paragraphs, A–F. Choose the correct heading for paragraphs B–E from the list of headings below. Write the correct number, i–vii.",
          options: [
            { key: "i", text: "An unexpected decision to save a service" },
            { key: "ii", text: "Why passengers really choose the train" },
            { key: "iii", text: "The rising price of air travel" },
            { key: "iv", text: "Practical reasons why the service is expensive" },
            { key: "v", text: "Experiments with old and new equipment" },
            { key: "vi", text: "The history of the first sleeper carriages" },
            { key: "vii", text: "Plans to make journeys faster" },
          ],
          questions: [
            { n: 1, text: "Paragraph B", answer: ["i"], distractors: [], explain: { evidence: "took the unusual step of buying several routes that German railways had abandoned in 2016", paraphrase: "'unusual step' = unexpected decision; buying abandoned routes = saving a service.", trap: "" } },
            { n: 2, text: "Paragraph C", answer: ["ii"], distractors: [], explain: { evidence: "Yet researchers who have interviewed passengers suggest that convenience matters just as much.", paraphrase: "The paragraph moves from the 'often given' reason to what passengers actually say.", trap: "The environment is mentioned first, but the paragraph's point is about real motives." } },
            { n: 3, text: "Paragraph D", answer: ["iv"], distractors: [], explain: { evidence: "Each sleeper carriage carries far fewer people than a day coach", paraphrase: "fewer people per carriage, track fees and staff costs = practical reasons for high costs.", trap: "" } },
            { n: 4, text: "Paragraph E", answer: ["v"], distractors: [], explain: { evidence: "One private operator leases old carriages instead of buying new ones", paraphrase: "leased old carriages and new sleeping pods = experiments with old and new equipment.", trap: "" } },
          ],
        },
        {
          type: "tfng",
          instructions: "Do the following statements agree with the information given in the passage? Write TRUE if the statement agrees with the information, FALSE if the statement contradicts the information, NOT GIVEN if there is no information on this.",
          options: [],
          questions: [
            { n: 5, text: "In the early 2000s, a sleeper berth usually cost less than a budget flight.", answer: ["FALSE"], distractors: [], explain: { evidence: "Cheap airlines offered tickets that were often less than half the price of a sleeper berth", paraphrase: "Flights were cheaper, so the statement is the opposite.", trap: "Both prices are mentioned, but the comparison goes the other way." } },
            { n: 6, text: "Passenger numbers on the Austrian overnight network increased after the routes were renewed.", answer: ["TRUE"], distractors: [], explain: { evidence: "Within three years, passenger numbers on its overnight network had risen by roughly a third", paraphrase: "'risen by roughly a third' = increased.", trap: "" } },
            { n: 7, text: "Younger travellers in particular say they choose rail for environmental reasons.", answer: ["TRUE"], distractors: [], explain: { evidence: "a growing number of travellers, particularly younger ones, say they choose rail for this reason", paraphrase: "'particularly younger ones' = younger travellers in particular.", trap: "" } },
            { n: 8, text: "Track fees for night trains are the same in every European country.", answer: ["FALSE"], distractors: [], explain: { evidence: "these charges vary widely", paraphrase: "'vary widely' contradicts 'the same'.", trap: "" } },
            { n: 9, text: "The operator that leases old carriages plans to buy new ones in the future.", answer: ["NOT GIVEN"], distractors: [], explain: { evidence: "One private operator leases old carriages instead of buying new ones", paraphrase: "The passage says nothing about future plans.", trap: "'buying new ones' appears in the text, which makes the statement look checkable." } },
            { n: 10, text: "Sleeping pods have proved popular with families.", answer: ["NOT GIVEN"], distractors: [], explain: { evidence: "Whether such designs will prove popular with families and older travellers is not yet clear.", paraphrase: "'not yet clear' = no information either way.", trap: "Students often choose FALSE here, but the text gives no answer." } },
          ],
        },
        {
          type: "completion",
          instructions: "Complete the summary below. Choose NO MORE THAN TWO WORDS from the passage for each answer.",
          wordLimit: 2,
          options: [],
          context: "An overnight train can save travellers the cost of a [[11]] and helps them avoid the long [[12]] found at airports. However, these trains are expensive to run, partly because beds take up much more [[13]] than seats.",
          questions: [
            { n: 11, text: "", answer: ["hotel"], distractors: [], explain: { evidence: "saves the cost of a hotel", paraphrase: "", trap: "" } },
            { n: 12, text: "", answer: ["security queues"], distractors: [], explain: { evidence: "avoids the long security queues of an airport", paraphrase: "", trap: "'queues' alone does not fit as well; the passage says 'security queues'." } },
            { n: 13, text: "", answer: ["space"], distractors: [], explain: { evidence: "beds take up much more space than seats", paraphrase: "", trap: "" } },
          ],
        },
      ],
    },
  },
];

export const LISTENING_BANK: Array<{ id: string; part: PartIn }> = [
  {
    id: "l-01",
    part: {
      part: 1,
      title: "Booking a bicycle tour",
      context: "A man is phoning a company to book a bicycle tour.",
      speakers: [
        { name: "Receptionist", gender: "female", accent: "GB" },
        { name: "Daniel", gender: "male", accent: "GB" },
      ],
      lines: [
        { speaker: "Receptionist", text: "Good morning, Riverside Bike Tours. How can I help you?" },
        { speaker: "Daniel", text: "Hi. I'd like to book a tour for my family, please." },
        { speaker: "Receptionist", text: "Of course. Can I take your name first?" },
        { speaker: "Daniel", text: "Yes, it's Daniel Harper. That's H-A-R-P-E-R." },
        { speaker: "Receptionist", text: "Thank you, Mr Harper. And which day were you thinking of?" },
        { speaker: "Daniel", text: "We wanted the thirteenth of June, but I see that's a Sunday. Is it possible to go on the fourteenth instead?" },
        { speaker: "Receptionist", text: "Yes, we have places on the 14 June. How many people will there be?" },
        { speaker: "Daniel", text: "There are four of us. Two adults and two children. Actually, my sister might join us, but she isn't sure, so let's say 4 for now." },
        { speaker: "Receptionist", text: "Fine. Now, we have two tours that day. The forest tour is quite long and a bit hilly, and the castle tour is shorter and follows the river." },
        { speaker: "Daniel", text: "The forest one sounds lovely, but our youngest is only six. I think the Castle tour would be better." },
        { speaker: "Receptionist", text: "Good choice. Will the children ride their own bikes?" },
        { speaker: "Daniel", text: "The older one will. For the six-year-old, could we hire a child seat?" },
        { speaker: "Receptionist", text: "Certainly, there's no extra charge for that. Helmets are included for everyone, too." },
        { speaker: "Daniel", text: "Great. Where do we meet? At the railway station?" },
        { speaker: "Receptionist", text: "A lot of people think that, but the station car park is closed for repairs at the moment. The group meets outside the museum, on Bridge Street." },
        { speaker: "Daniel", text: "Outside the museum. Got it. And what time does it start?" },
        { speaker: "Receptionist", text: "Please arrive at nine fifteen. The tour itself leaves at 9.30 sharp." },
        { speaker: "Daniel", text: "And how much is it?" },
        { speaker: "Receptionist", text: "Children under twelve pay twenty pounds, and adults are normally forty pounds, but on weekdays there's a discount, so it's £35 for each adult." },
        { speaker: "Daniel", text: "That's good. Is there anything we need to bring?" },
        { speaker: "Receptionist", text: "We provide water, so you don't need bottles. But the weather by the river can change quickly, so everyone should bring a raincoat." },
        { speaker: "Daniel", text: "OK. And how do I pay? Can I use a credit card?" },
        { speaker: "Receptionist", text: "Our card machine isn't working this week, I'm afraid, so we're asking everyone to pay by bank transfer. I'll email you the details." },
        { speaker: "Daniel", text: "No problem. Thanks very much for your help." },
      ],
      groups: [
        {
          type: "completion",
          instructions: "Complete the form below. Write NO MORE THAN TWO WORDS AND/OR A NUMBER for each answer.",
          wordLimit: 2,
          options: [],
          context: "RIVERSIDE BIKE TOURS – BOOKING FORM\nName: Daniel [[1]]\nDate of tour: [[2]]\nNumber of people: [[3]]\nTour: the [[4]] tour\nExtra equipment: one [[5]]\nMeeting point: outside the [[6]]\nTour starts at: [[7]]\nPrice per adult: £[[8]]\nEveryone should bring a [[9]]\nPayment by: [[10]]",
          questions: [
            { n: 1, answer: ["Harper"], distractors: [], explain: { evidence: "it's Daniel Harper. That's H-A-R-P-E-R.", paraphrase: "", trap: "Names are spelled letter by letter: spelling must be exact." } },
            { n: 2, answer: ["14 June", "June 14", "14th June", "June 14th"], distractors: [], explain: { evidence: "we have places on the 14 June", paraphrase: "", trap: "The thirteenth is mentioned first, but it is a Sunday." } },
            { n: 3, answer: ["4", "four"], distractors: [], explain: { evidence: "so let's say 4 for now", paraphrase: "", trap: "The sister 'might join', which tempts you to write 5." } },
            { n: 4, answer: ["Castle"], distractors: [], explain: { evidence: "I think the Castle tour would be better", paraphrase: "", trap: "The forest tour is described first and sounds 'lovely'." } },
            { n: 5, answer: ["child seat"], distractors: [], explain: { evidence: "could we hire a child seat", paraphrase: "", trap: "Helmets are mentioned, but they are included for everyone." } },
            { n: 6, answer: ["museum"], distractors: [], explain: { evidence: "The group meets outside the museum", paraphrase: "", trap: "The railway station is suggested first and then rejected." } },
            { n: 7, answer: ["9.30", "9:30", "9.30am", "9.30 am"], distractors: [], explain: { evidence: "The tour itself leaves at 9.30 sharp", paraphrase: "", trap: "'Arrive at nine fifteen' is the arrival time, not the start." } },
            { n: 8, answer: ["35"], distractors: [], explain: { evidence: "so it's £35 for each adult", paraphrase: "", trap: "Forty pounds is the normal price; twenty is for children." } },
            { n: 9, answer: ["raincoat"], distractors: [], explain: { evidence: "everyone should bring a raincoat", paraphrase: "", trap: "Water bottles are mentioned but not needed." } },
            { n: 10, answer: ["bank transfer"], distractors: [], explain: { evidence: "pay by bank transfer", paraphrase: "", trap: "Credit card is asked about, but the machine is not working." } },
          ],
        },
      ],
    },
  },
];
