import { Link } from 'react-router-dom';
import { BookIcon, PencilIcon, RepeatIcon } from './learningUi';

const TYPE_ICON = { content: <BookIcon />, practice: <PencilIcon />, 'mistake-review': <RepeatIcon /> };

const DailyPlan = ({ plan, title = "Today's Personalized Plan" }) => {
  if (!plan?.items?.length) return null;
  return (
    <section className="panel lr-plan" aria-labelledby="lr-plan-title">
      <div className="panel-head-row">
        <h3 id="lr-plan-title">{title}</h3>
        <span className="subtle-label">{plan.totalMinutes} of {plan.budgetMinutes} min</span>
      </div>
      <ol className="lr-plan-list">
        {plan.items.map((item) => (
          <li key={item.order} className="lr-plan-item">
            <span className="lr-plan-num" aria-hidden="true">{item.order}</span>
            <div className="lr-plan-body">
              <Link to={item.route}><strong>{item.title}</strong></Link>
              <small>{item.minutes} min{item.topic ? ` · ${item.topic}` : ''}</small>
              {item.reason && <p>{item.reason}</p>}
            </div>
            <span className="lr-plan-icon" aria-hidden="true">{TYPE_ICON[item.type] || null}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default DailyPlan;