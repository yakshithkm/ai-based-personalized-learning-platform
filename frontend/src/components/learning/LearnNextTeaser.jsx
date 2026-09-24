import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLearnNext } from '../../api/learning';
import { itemMeta, itemTitle } from './learningUi';

// Compact "Learn Next" entry point for the dashboard. Fetches on its own and renders nothing
// if the request fails, so it can never break the dashboard it sits in.
const LearnNextTeaser = () => {
  const [item, setItem] = useState(null);
  const [mode, setMode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getLearnNext()
      .then((res) => {
        if (cancelled) return;
        setItem(res.learnNext?.primary || null);
        setMode(res.mode);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!item) return null;

  return (
    <section className="panel lr-teaser" aria-label="Learn Next">
      <p className="eyebrow-label">{mode === 'cold-start' ? 'Start here' : 'Learn Next'}</p>
      <h3>{itemTitle(item)}</h3>
      <p>{itemMeta(item)}{item.content ? ` • ${item.content.estimatedMinutes} min` : ''}</p>
      <p>{item.reason}</p>
      <div className="lr-cta-row">
        <Link className="solid-btn" to={item.content ? `/learn/${item.id}` : '/learn'}>
          {item.content ? 'Start Learning' : 'See your plan'}
        </Link>
        <Link className="outline-btn" to="/learn">All recommendations</Link>
      </div>
    </section>
  );
};

export default LearnNextTeaser;