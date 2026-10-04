import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getLearnNext } from '../../api/learning';
import { itemMeta, itemTitle } from './learningUi';

// Compact "Learn Next" entry point for the dashboard. Fetches on its own and renders nothing
// if the request fails, so it can never break the dashboard it sits in.
const LearnNextTeaser = () => {
  const { t } = useTranslation();
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
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!item) return null;

  return (
    <section className="panel lr-teaser" aria-label={t('learn.learnNext')}>
      <p className="eyebrow-label">{mode === 'cold-start' ? t('learn.startHere') : t('learn.learnNext')}</p>
      <h3>{itemTitle(item, t)}</h3>
      <p>{itemMeta(item, t)}{item.content ? ` • ${t('learn.minutes', { count: item.content.estimatedMinutes })}` : ''}</p>
      <p>{item.reason}</p>
      <div className="lr-cta-row">
        <Link className="solid-btn" to={item.content ? `/learn/${item.id}` : '/learn'}>
          {item.content ? t('learn.startLearning') : t('learn.seePlan')}
        </Link>
        <Link className="outline-btn" to="/learn">{t('learn.allRecommendations')}</Link>
      </div>
    </section>
  );
};

export default LearnNextTeaser;