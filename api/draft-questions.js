// Vercel function: /api/draft-questions (logic in server/lib/draft.js via server/lib/api.js, shared with Express).
import { vercelHandler } from '../server/lib/vercel.js';

export default vercelHandler('draft-questions');
