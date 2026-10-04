import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { translateServerError } from '../i18n/serverErrors';
import { subjectLabel } from '../i18n/labels';
import { useLocaleFormat } from '../i18n/format';
import api from '../api/client';
import { downloadExamCertificate, downloadExamReport } from '../api/examClient';
import { CertificateIcon, DownloadIcon } from '../components/ResultIcons';
import { useToast } from '../context/ToastContext';
import { emitAttemptSubmitted } from '../utils/appEvents';

const formatDuration = (totalSeconds = 0, t) => {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return t('time.minSec', { m, s });
};

const ExamSimulationResultPage = () => {
  const { t } = useTranslation();
  const { formatPercent } = useLocaleFormat();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const [result, setResult] = useState(location.state?.result || null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [downloadingCertificate, setDownloadingCertificate] = useState(false);
  // The result summary itself carries the session id it was generated for, so once a
  // result is loaded (either from navigation state or the fetch below) it's the more
  // reliable source - navigation state is lost on a manual page refresh, but the result
  // summary is not.
  const sessionId = result?.sessionId || location.state?.sessionId || null;

  useEffect(() => {
    if (!sessionId) return;

    const fetchResultSummary = async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/exams/sessions/${sessionId}`);
        if (data?.resultSummary) {
          setResult(data.resultSummary);
        } else {
          setFetchError(t('examResult.summaryUnavailable'));
        }
      } catch (error) {
        setFetchError(translateServerError(t, error?.response?.data?.message, 'examResult.fetchFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchResultSummary();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  // Notify the app shell once a result is showing (whether it arrived via
  // navigation state right after finishing the exam, or via the fetch
  // above) so the header streak pill refreshes immediately instead of
  // waiting for the next full page load.
  useEffect(() => {
    if (result) {
      emitAttemptSubmitted({ source: 'exam-simulation' });
    }
  }, [result]);

  if (!result && !sessionId) {
    return <Navigate to="/exam-simulation" replace />;
  }

  if (!result) {
    return (
      <div className="page-grid">
        <section className="panel">
          <h2>{t('examResult.title')}</h2>
          <p>{loading ? t('examResult.loadingAnalytics') : fetchError || t('examResult.notAvailable')}</p>
          <div className="exam-action-row">
            <button className="outline-btn" onClick={() => navigate('/exam-simulation')}>
              {t('examResult.backToSimulation')}
            </button>
          </div>
        </section>
      </div>
    );
  }

  const weakTopics = (result.postTestAnalysis?.topMistakes || []).slice(0, 5);
  const mistakePatterns = (result.postTestAnalysis?.topMistakes || []).slice(0, 5);
  const nextActions = result.adaptiveFollowUp?.nextPracticePlan || [];
  const accuracyPerSubject = result.postTestAnalysis?.accuracyPerSubject || [];
  const timeSpentPerSubject = result.postTestAnalysis?.timeSpentPerSubject || [];
  const { correct = 0, wrong = 0, unattempted = 0 } = result.scoreSummary || {};
  const attemptedTotal = correct + wrong;
  const examAccuracy = attemptedTotal ? (correct / attemptedTotal) * 100 : 0;
  const totalTimeSpentSec = timeSpentPerSubject.reduce((sum, row) => sum + Number(row.timeSpentSec || 0), 0);

  const goPracticeWeakSubject = () => {
    const target = result.postTestAnalysis?.weakSubjects?.[0]?.subject;
    navigate(target ? `/practice?topic=${encodeURIComponent(`${target} - `)}` : '/practice');
  };

  const handleDownloadReport = async () => {
    if (!sessionId || downloadingReport) return;
    setDownloadingReport(true);
    try {
      await downloadExamReport(sessionId);
    } catch (error) {
      toast?.showToast?.(translateServerError(t, error.message, 'examResult.reportFailed'), { type: 'error' });
    } finally {
      setDownloadingReport(false);
    }
  };

  const handleDownloadCertificate = async () => {
    if (!sessionId || downloadingCertificate) return;
    setDownloadingCertificate(true);
    try {
      await downloadExamCertificate(sessionId);
    } catch (error) {
      toast?.showToast?.(translateServerError(t, error.message, 'examResult.certificateFailed'), { type: 'error' });
    } finally {
      setDownloadingCertificate(false);
    }
  };

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>{t('examResult.title')}</h2>
        <p>{t('examResult.complete')}</p>
      </section>

      <section className="panel">
        <h3>{t('examResult.postTest')}</h3>
        <div className="exam-score-grid">
          <div className="score-box">
            <span>{t('examResult.totalScore')}</span>
            <strong>{result.scoreSummary.totalScore} / {result.scoreSummary.maxScore}</strong>
          </div>
          <div className="score-box">
            <span>{t('common.accuracy')}</span>
            <strong>{formatPercent(examAccuracy.toFixed(1))}</strong>
          </div>
          <div className="score-box">
            <span>{t('common.correct')}</span>
            <strong>{correct}</strong>
          </div>
          <div className="score-box">
            <span>{t('common.incorrect')}</span>
            <strong>{wrong}</strong>
          </div>
          <div className="score-box">
            <span>{t('examResult.unanswered')}</span>
            <strong>{unattempted}</strong>
          </div>
          {totalTimeSpentSec > 0 && (
            <div className="score-box">
              <span>{t('practice.timeTaken')}</span>
              <strong>{formatDuration(totalTimeSpentSec, t)}</strong>
            </div>
          )}
          <div className="score-box">
            <span>{t('examResult.percentile')}</span>
            <strong>{formatPercent(result.scoreSummary.percentileEstimate)}</strong>
          </div>
          <div className="score-box">
            <span>{t('examResult.rankRange')}</span>
            <strong>
              {result.scoreSummary.rankRange.low} - {result.scoreSummary.rankRange.high}
            </strong>
          </div>
        </div>

        {!!accuracyPerSubject.length && (
          <div className="exam-interpretation-box">
            <h4>{t('examResult.bySubject')}</h4>
            <div className="mistake-grid">
              {accuracyPerSubject.map((row) => (
                <div className="score-box" key={row.subject}>
                  <span>{subjectLabel(t, row.subject)}</span>
                  <strong>{formatPercent(Number(row.accuracy || 0).toFixed(0))}</strong>
                  <small>{t('examResult.attemptedOf', { attempted: row.attempted, total: row.total })}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="exam-interpretation-box">
          <h4>{t('examResult.interpretation')}</h4>
          <p>{result.scoreInterpretation?.message}</p>
          <p>{result.scoreInterpretation?.rankMessage}</p>
          <p>{result.scoreInterpretation?.strengthWeaknessMessage}</p>
          <p>{result.scoreInterpretation?.whyThisRank}</p>
          <p>{result.scoreInterpretation?.howScoreCompares}</p>
        </div>

        <div className="exam-result-split">
          <div className="exam-interpretation-box">
            <h4>{t('navigation.weakTopics')}</h4>
            {weakTopics.length === 0 && <p>{t('examResult.noWeak')}</p>}
            {weakTopics.map((item) => (
              <p key={`${item.subject}-${item.concept}`}>
                {subjectLabel(t, item.subject)}: {item.concept}
              </p>
            ))}
          </div>

          <div className="exam-interpretation-box">
            <h4>{t('examResult.mistakePatterns')}</h4>
            {mistakePatterns.length === 0 && <p>{t('examResult.noPattern')}</p>}
            {mistakePatterns.map((item) => (
              <p key={`${item.subject}-${item.concept}-pattern`}>
                {t('examResult.repeatedLine', { subject: subjectLabel(t, item.subject), concept: item.concept, count: item.count })}
              </p>
            ))}
          </div>
        </div>

        <div className="exam-interpretation-box">
          <h4>{t('examResult.nextAction')}</h4>
          {nextActions.length === 0 && <p>{t('examResult.defaultNext')}</p>}
          {nextActions.map((action, index) => (
            <p key={`${action.type}-${index}`}>
              {action.label}: {action.reason}
            </p>
          ))}
        </div>

        <div className="exam-action-row">
          {!!sessionId && (
            <button
              type="button"
              className={`outline-btn ${downloadingReport ? 'btn-loading-pulse' : ''}`}
              onClick={handleDownloadReport}
              disabled={downloadingReport}
            >
              {downloadingReport ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  {t('examResult.generatingReport')}
                </>
              ) : (
                <>
                  <DownloadIcon />
                  {t('examResult.downloadReport')}
                </>
              )}
            </button>
          )}
          {!!sessionId && (
            <button
              type="button"
              className={`outline-btn ${downloadingCertificate ? 'btn-loading-pulse' : ''}`}
              onClick={handleDownloadCertificate}
              disabled={downloadingCertificate}
            >
              {downloadingCertificate ? (
                <>
                  <span className="btn-spinner" aria-hidden="true" />
                  {t('examResult.generatingCertificate')}
                </>
              ) : (
                <>
                  <CertificateIcon />
                  {t('examResult.downloadCertificate')}
                </>
              )}
            </button>
          )}
          {!!result.postTestAnalysis?.weakSubjects?.length && (            <button className="outline-btn" onClick={goPracticeWeakSubject}>
              {t('examResult.practiceWeak')}
            </button>
          )}
          <button className="outline-btn" onClick={() => navigate('/exam-simulation')}>
            {t('examResult.takeAnother')}
          </button>
          <button className="solid-btn" onClick={() => navigate('/dashboard')}>
            {t('common.backToDashboard')}
          </button>
        </div>
      </section>
    </div>
  );
};

export default ExamSimulationResultPage;