// Top-right warning pop-up for "no person in front of the camera". Uses the app's existing
// toast look (.toast-stack / .toast-item) so it feels native.
import { useTranslation } from 'react-i18next';
import { translateProctorMessage } from '../../i18n/proctorMessages';

const PresenceToast = ({ toast, onDismiss }) => {
  const { t } = useTranslation();
  if (!toast) return null;
  const isFinal = toast.kind === 'final';

  return (
    <div className="toast-stack exam-presence-stack" aria-live="assertive">
      <div className={`toast-item toast-warning ${isFinal ? 'final' : ''}`} role="alert">
        <span>
          <strong>{isFinal ? `⚠ ${t('proctor.cameraCheck')}` : `⚠ ${t('proctor.noPersonTitle')}`}</strong>
          <br />
          {translateProctorMessage(t, toast.message)}
          {toast.detail && <small className="toast-detail">{translateProctorMessage(t, toast.detail)}</small>}
        </span>
        {!isFinal && (
          <button type="button" className="toast-dismiss" onClick={onDismiss} aria-label={t('proctor.dismissWarning')}>
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default PresenceToast;