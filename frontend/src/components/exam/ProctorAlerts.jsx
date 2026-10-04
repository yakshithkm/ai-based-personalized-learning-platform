import { useTranslation } from 'react-i18next';
import { CAMERA_UNAVAILABLE_MESSAGE } from '../../hooks/useWebcamMonitor';
import { translateProctorMessage } from '../../i18n/proctorMessages';

// One aria-live region for all proctoring messages. Camera warnings are derived from camera
// status (shown while the camera is unavailable), so they can never repeat as separate alerts.
const ProctorAlerts = ({ camera, notice }) => {
  const { t } = useTranslation();
  const cameraUnavailable = camera.status === 'unavailable';
  const hasContent = cameraUnavailable || camera.showRestored || Boolean(notice);
  if (!hasContent) return null;

  return (
    <div className="exam-proctor-alerts" aria-live="polite">
      {cameraUnavailable && (
        <section className="panel exam-proctor-alert camera" role="alert">
          <strong>⚠ {t('proctor.cameraWarning')}</strong>
          <p>{translateProctorMessage(t, CAMERA_UNAVAILABLE_MESSAGE)}</p>
        </section>
      )}
      {camera.showRestored && (
        <section className="panel exam-proctor-alert restored" role="status">
          <p>{t('proctor.cameraRestored')}</p>
        </section>
      )}
      {notice && (
        <section
          className={`panel exam-proctor-alert focus ${notice.kind === 'final' ? 'final' : ''}`}
          role="alert"
        >
          <p>{translateProctorMessage(t, notice.message)}</p>
          {notice.detail && <small>{translateProctorMessage(t, notice.detail)}</small>}
        </section>
      )}
    </div>
  );
};

export default ProctorAlerts;