import { useTranslation } from 'react-i18next';
import { useScrollReveal, useCountUp } from '../../hooks/useScrollReveal';

// Illustrative product preview only — mirrors the real Dashboard/Analytics
// widgets (readiness ring, weak-topic list, streak, recommendation feed)
// so visitors see an accurate picture of the actual product UI, not a
// generic mockup. Sample numbers are placeholders for the marketing
// preview and are not tied to any real account.
const weakTopics = [
  { key: 'thermodynamics', accuracy: 54 },
  { key: 'organicReactions', accuracy: 61 },
  { key: 'coordinateGeometry', accuracy: 68 },
];

const trend = [42, 55, 48, 63, 71, 66, 82];

const DashboardPreview = () => {
  const { t } = useTranslation();
  const [ref, isVisible] = useScrollReveal({ threshold: 0.3 });
  const readiness = useCountUp(78, { isActive: isVisible });
  const streak = useCountUp(12, { isActive: isVisible, duration: 900 });

  return (
    <div className="dash-preview" ref={ref}>
      <div className="dash-preview-glow" aria-hidden="true" />

      <div className="dash-preview-card dash-preview-readiness">
        <span className="dash-preview-label">{t('dashboard.examReadiness')}</span>
        <span
          className="progress-ring dash-preview-ring"
          style={{ '--ring-value': readiness }}
          role="img"
          aria-label={t('home.preview.readinessAria', { score: readiness })}
        >
          <span className="progress-ring-inner">
            {readiness}
            <small>/ 100</small>
          </span>
        </span>
        <span className="dash-preview-caption">{t('home.preview.caption')}</span>
      </div>

      <div className="dash-preview-card dash-preview-trend">
        <span className="dash-preview-label">{t('home.preview.trend')}</span>
        <div className="dash-preview-bars" aria-hidden="true">
          {trend.map((value, index) => (
            <span
              key={index}
              className="dash-preview-bar"
              style={{ height: isVisible ? `${value}%` : '4%' }}
            />
          ))}
        </div>
      </div>

      <div className="dash-preview-card dash-preview-weak">
        <span className="dash-preview-label">{t('home.preview.weakDetected')}</span>
        <ul>
          {weakTopics.map((item) => (
            <li key={item.key}>
              <span>{t(`home.sampleTopics.${item.key}`)}</span>
              <span className="dash-preview-pill">{item.accuracy}%</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="dash-preview-card dash-preview-streak">
        <span className="dash-preview-label">{t('home.preview.streak')}</span>
        <span className="dash-preview-streak-value">{t('dashboard.daysCount', { count: streak })}</span>
      </div>
    </div>
  );
};

export default DashboardPreview;