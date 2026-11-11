// The three sample flows from the Figma page (5 steps each).
// Text lives in i18n under flows.<id>.<step>; this file only holds structure.
// `next` names the control that advances the step (answers stay tappable).

export const FLOWS = {
  a: {
    persona: 'meera',
    steps: [
      { kind: 'today' },
      { kind: 'call', options: 4, camera: true, nextOn: 'any' },
      { kind: 'call', herWords: true, options: 3, somethingElse: true, nextOn: 'any' },
      { kind: 'next', tone: 'tips' },
      { kind: 'list' },
    ],
  },
  b: {
    persona: 'reena',
    steps: [
      { kind: 'network' },
      { kind: 'phone' },
      { kind: 'next', tone: 'urgent' },
      { kind: 'list' },
      { kind: 'list', who: true },
    ],
  },
  c: {
    persona: 'anita',
    steps: [
      { kind: 'twoTalks' },
      { kind: 'call', yesNo: true, nextOn: 'camera' },
      { kind: 'photo' },
      { kind: 'next', tone: 'baby' },
      { kind: 'call', options: 3, nextOn: 'any', support: true },
    ],
  },
};

export const FLOW_IDS = Object.keys(FLOWS);
