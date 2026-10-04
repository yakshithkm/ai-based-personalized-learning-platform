import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { translateServerError } from '../i18n/serverErrors';
import api from '../api/client';
import { useToast } from '../context/ToastContext';

// Never hardcoded: the referral link's base URL comes from the frontend's own
// environment configuration, falling back to the browser's own origin at
// runtime if that isn't set (works for any deployment without a rebuild).
const getClientBaseUrl = () =>
  (import.meta.env.VITE_CLIENT_URL || window.location.origin).replace(/\/$/, '');

const CopyIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
    <path d="M16 1H4a2 2 0 00-2 2v14h2V3h12V1zm3 4H8a2 2 0 00-2 2v14a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2zm0 16H8V7h11v14z" />
  </svg>
);

const ShareIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
    <path d="M18 16.08a2.9 2.9 0 00-1.94.75l-7.1-4.14a3.07 3.07 0 000-1.38l7.1-4.14a2.9 2.9 0 101.94-5.17 2.92 2.92 0 100 5.84 2.9 2.9 0 00-.05-.53L9.85 11a3.07 3.07 0 000 2l7.1 4.14a2.9 2.9 0 105.05 1.94 2.9 2.9 0 00-4-2z" />
  </svg>
);

const InviteFriendsModal = ({ open, onClose }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { data } = await api.get('/referrals/me');
        setSummary(data);
      } catch (err) {
        setError(translateServerError(t, err?.response?.data?.message, 'invite.loadFailed'));
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [open]);

  if (!open) return null;

  const referralCode = summary?.referralCode || '';
  const inviteLink = referralCode ? `${getClientBaseUrl()}/register?ref=${referralCode}` : '';

  const copyLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast?.showToast(t('invite.copied'), { type: 'success' });
    } catch {
      toast?.showToast(t('invite.copyFailed'), {
        type: 'error',
      });
    }
  };

  const shareLink = async () => {
    if (!inviteLink) return;
    const shareData = {
      title: t('invite.shareTitle'),
      text: t('invite.description'),
      url: inviteLink,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User dismissed the native share sheet - not an error worth surfacing.
      }
    } else {
      copyLink();
    }
  };

  const emailInvite = async () => {
    if (!inviteLink) return;
    const subject = encodeURIComponent(t('invite.shareTitle'));
    const body = encodeURIComponent(
      t('invite.emailBody', { link: inviteLink, interpolation: { escapeValue: false } })
    );

    // Hands off to the OS/browser's default mail client via a temporary
    // anchor (more robust than setting window.location.href - it doesn't
    // trigger the page's own navigation/unload handling). On a device with
    // no mail client configured, this silently does nothing visible - there
    // is no reliable way for JS to detect that. So the link is also copied
    // as a fallback: the user always ends up with it ready to paste.
    const mailtoAnchor = document.createElement('a');
    mailtoAnchor.href = `mailto:?subject=${subject}&body=${body}`;
    mailtoAnchor.click();
    try {
      await navigator.clipboard.writeText(inviteLink);
      toast?.showToast(t('invite.emailOpening'), {
        type: 'info',
      });
    } catch {
      // Clipboard access can fail (e.g. no permission) - the mailto attempt
      // above already fired, so there's nothing further to do here.
    }
  };

  return (
    <div className="invite-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="gam-modal invite-friends-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-friends-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="invite-modal-close" aria-label={t('common.close')} onClick={onClose}>
          ×
        </button>
        <h3 id="invite-friends-title">{t('common.inviteFriends')}</h3>
        <p className="invite-modal-desc">
          {t('invite.description')}
        </p>

        {loading && <p className="invite-modal-status">{t('invite.loading')}</p>}
        {!!error && <p className="error-text">{error}</p>}

        {!loading && !error && summary && (
          <>
            <div className="invite-link-row">
              <input
                type="text"
                readOnly
                value={inviteLink}
                aria-label={t('invite.linkAria')}
                onFocus={(event) => event.target.select()}
              />
              <button type="button" className="outline-btn" onClick={copyLink}>
                <CopyIcon /> {t('invite.copyLink')}
              </button>
            </div>

            <div className="invite-modal-actions">
              <button type="button" className="solid-btn" onClick={shareLink}>
                <ShareIcon /> {t('invite.share')}
              </button>
              <button type="button" className="outline-btn" onClick={emailInvite}>
                {t('invite.emailInvite')}
              </button>
            </div>

            <div className="invite-stats-grid">
              <div className="invite-stat-box">
                <span>{t('invite.code')}</span>
                <strong>{referralCode}</strong>
              </div>
              <div className="invite-stat-box">
                <span>{t('invite.friendsInvited')}</span>
                <strong>{summary.friendsInvited}</strong>
              </div>
              <div className="invite-stat-box">
                <span>{t('invite.signups')}</span>
                <strong>{summary.successfulSignups}</strong>
              </div>
            </div>

            {summary.friendsInvited === 0 && (
              <p className="invite-modal-empty">
                {t('invite.emptyLine1')}
                <br />
                {t('invite.emptyLine2')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InviteFriendsModal;