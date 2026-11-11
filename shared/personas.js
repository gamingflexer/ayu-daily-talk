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
};

export const PERSONA_IDS = Object.keys(PERSONAS);

export function getPersona(id) {
  return PERSONAS[id] || PERSONAS.sunita;
}

/** Short, English context block for the AI prompt. */
export function personaContext(p) {
  const lines = [
    `Name: ${p.name}, ${p.age}, ${p.village}, ${p.district}. Prefers ${p.language}.`,
    p.stage === 'pregnant'
      ? `Pregnant: week ${p.weeks}, pregnancy number ${p.pregnancy}.`
      : `Gave birth ${p.daysAfterBirth} days ago. Talk covers baby and mother.`,
    p.hb ? `Last Hb: ${p.hb.value} g/dL at week ${p.hb.week}.` : null,
    p.bp ? `BP trend: ${p.bp.map((r) => `${r.sys}/${r.dia} (${r.label})`).join(', ')}.` : null,
    p.medicines?.length
      ? `Medicines: ${p.medicines.map((m) => `${m.name} ${m.when}, taken ${m.takenLast7}/7 days${m.note ? `, ${m.note}` : ''}`).join('; ')}.`
      : null,
    p.nextVisit ? `Next doctor visit: ${p.nextVisit.date} at ${p.nextVisit.place} (${p.nextVisit.km} km).` : 'No doctor visit booked yet.',
    `ASHA: ${p.asha}. Nearest facility: ${p.phc.name}, ${p.phc.km} km.`,
  ];
  return lines.filter(Boolean).join('\n');
}
