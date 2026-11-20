// ASHA app routes. Every screen reads the one store on this phone (src/store.jsx).
import './asha.css';
import { match } from '../router.js';
import { AshaToday } from './Today.jsx';
import { AshaWomen } from './Women.jsx';
import { AshaWomanForm } from './WomanForm.jsx';
import { AshaWoman } from './Woman.jsx';
import { AshaAlert } from './Alert.jsx';
import { AshaQuestions, AshaSetView } from './Questions.jsx';
import { AshaNewSet } from './NewSet.jsx';
import { AshaReview } from './Review.jsx';
import { AshaSend } from './Send.jsx';

/**
 * The screen for any path under /asha (unknown ones show Today).
 * @param {{path: string, query?: object}} props
 */
export function AshaRoutes({ path }) {
  let p;
  if (path === '/asha/women') return <AshaWomen />;
  if (path === '/asha/add') return <AshaWomanForm key="add" />;
  if ((p = match('/asha/edit/:id', path))) return <AshaWomanForm key={`edit-${p.id}`} id={p.id} />;
  if ((p = match('/asha/w/:id', path))) return <AshaWoman key={p.id} id={p.id} />;
  if ((p = match('/asha/alert/:entryId', path))) return <AshaAlert key={p.entryId} entryId={p.entryId} />;
  if (path === '/asha/questions') return <AshaQuestions />;
  if (path === '/asha/new') return <AshaNewSet />;
  if ((p = match('/asha/set/:setId', path))) return <AshaSetView key={p.setId} setId={p.setId} />;
  if ((p = match('/asha/review/:setId/:n', path))) return <AshaReview key={`${p.setId}/${p.n}`} setId={p.setId} n={p.n} />;
  if ((p = match('/asha/send/:setId', path))) return <AshaSend key={p.setId} setId={p.setId} />;
  return <AshaToday />;
}
