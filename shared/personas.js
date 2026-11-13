// Mock personas. Every name, number and place is made up for the demo.
// No real patient data. Display text lives in src/i18n; this file holds the
// facts the screens and the AI prompt need.

export const PERSONAS = {
  sunita: {
    id: 'sunita',
    name: 'Sunita',
    age: 26,
    district: 'Nandurbar, Maharashtra',
    village: 'Bondgaon',
    language: 'Marathi',
    phoneMasked: '98•• ••• 210',
    stage: 'pregnant',
    weeks: 24,
    day: 3,
    pregnancy: 1,
    asha: 'Kamla',
    phc: { name: 'PHC Jambhulni', km: 7, openTill: '5 pm' },
    hospital: { name: 'District Hospital Nandurbar', km: 32 },
    husband: 'Ramesh',
    companion: 'Shanta (mother-in-law)',
    hb: { value: 9.8, week: 20 },
    bp: [
      { label: '3 wk ago', sys: 118, dia: 76 },
      { label: '2 wk ago', sys: 120, dia: 78 },
      { label: '10 d ago', sys: 124, dia: 80 },
      { label: '4 d ago', sys: 130, dia: 86 },
      { label: 'today', sys: 138, dia: 92 },
    ],
    medicines: [
      { name: 'Iron + folic acid (IFA)', when: 'after dinner', takenLast7: 5 },
      { name: 'Calcium', when: 'after lunch', takenLast7: 4, note: 'stopped 3 days — nausea (her words)' },
    ],
    nextVisit: { date: 'Fri 15 Nov', place: 'PHC Jambhulni', km: 7 },
  },
  meera: {
    id: 'meera',
    name: 'Meera',
    age: 23,
    district: 'Nandurbar, Maharashtra',
    village: 'Khapar',
    language: 'Marathi',
    phoneMasked: '97•• ••• 518',
    stage: 'pregnant',
    weeks: 9,
    day: 2,
    pregnancy: 1,
    asha: 'Lata',
    phc: { name: 'PHC Khapar', km: 6, openTill: '5 pm', bus: '8:10' },
    hospital: { name: 'District Hospital Nandurbar', km: 41 },
    medicines: [{ name: 'Iron + folic acid (IFA)', when: 'after dinner', takenLast7: 2 }],
    nextVisit: null,
  },
  reena: {
    id: 'reena',
    name: 'Reena',
    age: 27,
    district: 'Bahraich, Uttar Pradesh',
    village: 'Mihinpurwa',
    language: 'Hindi',
    phoneMasked: '99•• ••• 732',
    stage: 'pregnant',
    weeks: 34,
    day: 1,
    pregnancy: 2,
    asha: 'Kamla',
    phc: { name: 'CHC Mihinpurwa', km: 18, openTill: '24 hours' },
    husband: 'Raju',
    companion: 'mother-in-law',
    backupTransport: "Raju's tempo · 98•• •• 4410",
    // Flow B: the village BP machine is broken, so swelling + headache are asked first.
    focus:
      'Village BP machine broken for a month — no BP readings. Ask early, with cards: do her feet or face look swollen (ask_yes_no with picture_set feet_swelling, sign swelling_feet), and a headache that will not go (sign severe_headache).',
    moneyKept: 1500,
    medicines: [
      { name: 'Iron + folic acid (IFA)', when: 'after dinner', takenLast7: 6 },
      { name: 'Calcium', when: 'after lunch', takenLast7: 6 },
    ],
  },
  anita: {
    id: 'anita',
    name: 'Anita',
    age: 24,
    district: 'Gaya, Bihar',
    village: 'Belaganj',
    language: 'Hindi',
    phoneMasked: '96•• ••• 045',
    stage: 'postnatal',
    daysAfterBirth: 5,
    asha: 'Pinky',
    phc: { name: 'PHC Belaganj', km: 9, openTill: '2 pm' },
    medicines: [{ name: 'Iron + folic acid (IFA)', when: 'after dinner', takenLast7: 4 }],
  },
  // Not pregnant: an older woman on a new medicine (demo 2). Pregnancy rules never apply to her.
  shanti: {
    id: 'shanti',
    name: 'Shanti',
    age: 68,
    district: 'Sitapur, Uttar Pradesh',
    village: 'Mishrikh',
    language: 'Hindi',
    phoneMasked: '94•• ••• 381',
    stage: 'elder',
    asha: 'Kamla',
    phc: { name: 'PHC Mishrikh', km: 5, openTill: '2 pm' },
    husband: 'Mohan (son)',
    conditions: ['Type 2 diabetes (sugar), found last month'],
    medicines: [{ name: 'Metformin 500 mg', when: 'after breakfast', takenLast7: 5, startedDaysAgo: 5, isNew: true }],
    nextVisit: { date: 'Mon 9 Dec', place: 'PHC Mishrikh', km: 5 },
  },
};

export const PERSONA_IDS = Object.keys(PERSONAS);

export function getPersona(id) {
  return PERSONAS[id] || PERSONAS.reena;
}

/** Short, English context block for the AI prompt. */
export function personaContext(p) {
  const lines = [
    `Name: ${p.name}, ${p.age}, ${p.village}, ${p.district}. Prefers ${p.language}.`,
    p.stage === 'pregnant'
      ? `Pregnant: week ${p.weeks}, pregnancy number ${p.pregnancy}.`
      : p.stage === 'postnatal'
        ? `Gave birth ${p.daysAfterBirth} days ago. Talk covers baby and mother.`
        : `Not pregnant. ${(p.conditions || []).join('; ')}. Do not ask pregnancy questions.`,
    ...(p.medicines || [])
      .filter((m) => m.isNew)
      .map(
        (m) =>
          `NEW medicine: ${m.name}, started ${m.startedDaysAgo} days ago. Today's focus: how she is on it. Ask first how her stomach has been since the new tablet` +
          ` (stomach_upset picture set: a little upset / vomiting / no problem). Mild stomach upset or loose motion in the first weeks is common: reassure her, say take it with food and keep taking it, and that Ayu asks again tomorrow and tells the doctor if it does not settle.` +
          ` Then, without waiting for her to speak, go straight on to the danger signs with it, one yes/no card each: vomiting or cannot keep food down (vomiting_no_food), very thirsty / dizzy / little urine (dehydration), strong belly pain (severe_abdominal_pain). Then call red_flag_check and finish_talk. Never tell her to stop the tablet.`,
      ),
    p.hb ? `Last Hb: ${p.hb.value} g/dL at week ${p.hb.week}.` : null,
    p.bp ? `BP trend: ${p.bp.map((r) => `${r.sys}/${r.dia} (${r.label})`).join(', ')}.` : null,
    p.medicines?.length
      ? `Medicines: ${p.medicines.map((m) => `${m.name} ${m.when}, taken ${m.takenLast7}/7 days${m.note ? `, ${m.note}` : ''}`).join('; ')}.`
      : null,
    p.nextVisit ? `Next doctor visit: ${p.nextVisit.date} at ${p.nextVisit.place} (${p.nextVisit.km} km).` : 'No doctor visit booked yet.',
    `ASHA: ${p.asha}. Nearest facility: ${p.phc.name}, ${p.phc.km} km.`,
    p.focus ? `Today's focus: ${p.focus}` : null,
  ];
  return lines.filter(Boolean).join('\n');
}
