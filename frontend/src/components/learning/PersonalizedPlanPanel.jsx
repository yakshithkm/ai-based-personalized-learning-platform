import { useEffect, useState } from 'react';
import { getDailyPlan } from '../../api/learning';
import DailyPlan from './DailyPlan';

// Study Plan integration: today's plan generated from real weaknesses/mastery. Non-blocking.
const PersonalizedPlanPanel = () => {
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    let cancelled = false;
    getDailyPlan()
      .then((res) => {
        if (!cancelled) setPlan(res.dailyPlan);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return <DailyPlan plan={plan} title="Today's Personalized Plan" />;
};

export default PersonalizedPlanPanel;