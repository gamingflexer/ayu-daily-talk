// Vercel function: /api/summary (logic in server/lib/api.js, shared with Express).
import { vercelHandler } from '../server/lib/vercel.js';

export default vercelHandler('summary');
