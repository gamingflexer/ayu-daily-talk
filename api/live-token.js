// Vercel function: /api/live-token (logic in server/lib/api.js, shared with Express).
import { vercelHandler } from '../server/lib/vercel.js';

export default vercelHandler('live-token');
