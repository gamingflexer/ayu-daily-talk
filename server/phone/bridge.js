// STUB — phone-call fallback (PSTN). Not implemented.
//
// This file fixes the interface so the rest of the app can be built against
// it. The design is in ./README.md. Every route answers 501 today.

import express from 'express';

/**
 * What a real phone bridge must provide.
 * @typedef {object} PhoneBridge
 * @property {(req: {phone: string, persona: string, lang: string}) => Promise<{callId: string}>} startCall
 *   Ayu calls her number (outbound) through an Indian SIP trunk.
 * @property {(callId: string) => Promise<void>} endCall
 * @property {(callId: string, digit: '1'|'2'|'3'|'9'|'0') => void} onDtmf
 *   Keypad answer: 1 yes / first option, 2 no / second, 3 not sure / third, 9 repeat, 0 talk to a person.
 * @property {(callId: string, purpose: string) => Promise<{smsSent: boolean}>} requestPhotoBySms
 *   Ayu can't see her on a call, so a photo request becomes an SMS link for later.
 */

/** @type {PhoneBridge} */
export const phoneBridge = {
  async startCall() {
    throw new Error('Phone bridge not implemented — see server/phone/README.md');
  },
  async endCall() {},
  onDtmf() {},
  async requestPhotoBySms() {
    return { smsSent: false };
  },
};

export const phoneRouter = express.Router();

phoneRouter.post('/call', (_req, res) => {
  res.status(501).json({
    error: 'Phone-call fallback is a stub in this demo.',
    design: 'server/phone/README.md',
  });
});
