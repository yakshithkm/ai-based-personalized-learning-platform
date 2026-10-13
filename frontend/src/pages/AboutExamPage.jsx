import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import LanguageSelector from '../components/LanguageSelector';
import ThemeToggle from '../components/ThemeToggle';
import { subjectLabel } from '../i18n/labels';
import BrandLogo from '../components/BrandLogo';
import Footer from '../components/Footer';
import Reveal from '../components/landing/Reveal';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  CalculatorIcon,
  ExternalLinkIcon,
  MapPinIcon,
  MedicalIcon,
  NoticeIcon,
} from '../components/landing/icons';

// Centralized exam reference data. Every fact here (names, authorities,
// subjects, official URLs) is drawn verbatim from the official examination
// authorities; nothing year-specific (dates, fees, eligibility numbers) is
// hardcoded, and every "Apply" link points at the authority's own official
// site rather than a scraped or guessed year-specific application URL —
// see each exam's `statusNote`.
const exams = [
  {
    id: 'neet',
    name: 'NEET (UG)',
    fullName: 'National Eligibility cum Entrance Test (Undergraduate)',
    authority: 'National Testing Agency (NTA)',
    Icon: MedicalIcon,
    subjects: ['Physics', 'Chemistry', 'Biology'],
    links: {
      website: { url: 'https://neet.nta.nic.in/' },
      apply: { url: 'https://neet.nta.nic.in/' },
      notices: { url: 'https://neet.nta.nic.in/public-notices/' },
    },
    comparison: {
      authority: 'NTA',
    },
  },
  {
    id: 'jee',
    name: 'JEE Main',
    fullName: 'Joint Entrance Examination (Main)',
    authority: 'National Testing Agency (NTA)',
    Icon: CalculatorIcon,
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    links: {
      website: { url: 'https://jeemain.nta.nic.in/' },
      apply: { url: 'https://jeemain.nta.nic.in/' },
      notices: { url: 'https://jeemain.nta.nic.in/documents/' },
    },
    comparison: {
      authority: 'NTA',
    },
  },
  {
    id: 'kcet',
    name: 'Karnataka CET (KCET / UGCET)',
    fullName: 'Karnataka Undergraduate Common Entrance Test',
    authority: 'Karnataka Examinations Authority (KEA)',
    Icon: MapPinIcon,
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
    links: {
      website: { url: 'https://cetonline.karnataka.gov.in/kea/' },
      apply: { url: 'https://cetonline.karnataka.gov.in/kea/' },
      notices: { url: 'https://cetonline.karnataka.gov.in/kea/' },
    },
    comparison: {
      authority: 'KEA',
    },
  },
];

// Official names, conducting authorities and URLs are intentionally NOT translated:
// translating them could change their meaning or make them unrecognizable. Only the
// explanatory UI prose around them is localized (see aboutExam.* in the locale files).
const StatusNote = () => {
  const { t } = useTranslation();
  return (
    <p className="exam-status-note">
      <CalendarIcon aria-hidden="true" />
      {t('aboutExam.statusNote')}
    </p>
  );
};

const OfficialLinkButton = ({ href, children, variant = 'outline' }) => {
  const { t } = useTranslation();
  return (
    <a
      className={variant === 'solid' ? 'solid-btn' : 'outline-btn'}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t('aboutExam.opensNewTab', { label: children })}
    >
      {children} ↗
    </a>
  );
};

const AboutExamPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const examText = (id, field, options) => t(`aboutExam.exams.${id}.${field}`, options);

  return (
    <div className="landing-page about-exam-page">
      <div className="landing-noise" aria-hidden="true" />

      <header className="landing-topbar about-exam-topbar">
        <BrandLogo className="landing-logo" to="/" />
        <span />
        <div className="about-exam-topbar-actions">
          <LanguageSelector variant="compact" />
          <ThemeToggle />
          <button
            type="button"
            className="outline-btn about-exam-back-top"
            onClick={() => navigate('/')}
          >
            <ArrowLeftIcon />
            <span>{t('common.backToHome')}</span>
          </button>
        </div>
      </header>

      <section className="landing-section about-exam-header">
        <Reveal as="span" className="section-eyebrow about-exam-badge">
          {t('aboutExam.badge')}
        </Reveal>
        <Reveal as="h1" delay={40}>
          {t('aboutExam.title')}
        </Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={80}>
          {t('aboutExam.subtitle')}
        </Reveal>
      </section>

      <section className="landing-section about-exam-cards-section">
        <div className="about-exam-grid">
          {exams.map((exam, index) => (
            <Reveal as="article" className="about-exam-card" key={exam.id} delay={index * 90}>
              <div className="about-exam-card-head">
                <span className="about-exam-icon" aria-hidden="true">
                  <exam.Icon />
                </span>
                <div>
                  <h2>{exam.name}</h2>
                  <p className="about-exam-fullname">{exam.fullName}</p>
                </div>
              </div>

              <p className="about-exam-authority">
                <strong>{t('aboutExam.conductingAuthority')}:</strong> {exam.authority}
              </p>

              <p className="about-exam-purpose">{examText(exam.id, 'purpose')}</p>

              <h3>{t('aboutExam.applicationsUses')}</h3>
              <ul className="about-exam-list">
                {[].concat(examText(exam.id, 'uses', { returnObjects: true })).map((use) => (
                  <li key={use}>{use}</li>
                ))}
              </ul>

              <h3>{t('aboutExam.subjects')}</h3>
              <ul className="about-exam-chip-list">
                {exam.subjects.map((subject) => (
                  <li key={subject} className="about-exam-chip">
                    {subjectLabel(t, subject)}
                  </li>
                ))}
              </ul>
              {examText(exam.id, 'subjectsNote', { defaultValue: '' }) && (
                <p className="about-exam-subjects-note">{examText(exam.id, 'subjectsNote')}</p>
              )}

              <div className="about-exam-who">
                <h3>{t('aboutExam.whoShouldConsider', { exam: exam.id === 'kcet' ? 'KCET' : exam.name })}</h3>
                <p>{examText(exam.id, 'whoText')}</p>
              </div>

              <div className="about-exam-links">
                <h3>{t('aboutExam.officialLinks')}</h3>
                <div className="about-exam-link-row">
                  <OfficialLinkButton href={exam.links.website.url} variant="solid">
                    {examText(exam.id, 'linkWebsite')}
                  </OfficialLinkButton>
                  <OfficialLinkButton href={exam.links.apply.url}>
                    {examText(exam.id, 'linkApply')}
                  </OfficialLinkButton>
                  <OfficialLinkButton href={exam.links.notices.url}>
                    {examText(exam.id, 'linkNotices')}
                  </OfficialLinkButton>
                </div>
                <StatusNote />
                <p className="about-exam-leaving-note">
                  {t('aboutExam.leavingNote')}
                </p>
              </div>

              <div className="about-exam-notice">
                <h3>
                  <NoticeIcon aria-hidden="true" />
                  {t('aboutExam.latestUpdate')}
                </h3>
                <p>
                  {t('aboutExam.noticeGeneric')}
                  {' '}
                  {examText(exam.id, 'noticeSummary')}
                </p>
                <a
                  className="about-exam-notice-link"
                  href={exam.links.notices.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('aboutExam.viewNotice')}
                  <ExternalLinkIcon aria-hidden="true" />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section about-exam-comparison-section">
        <Reveal as="h2">{t('aboutExam.comparisonTitle')}</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={40}>
          {t('aboutExam.comparisonSubtitle')}
        </Reveal>

        <Reveal as="div" delay={80} className="about-exam-table-wrap">
          <table className="about-exam-table">
            <thead>
              <tr>
                <th scope="col">{t('aboutExam.colExam')}</th>
                <th scope="col">{t('aboutExam.conductingAuthorityTitle')}</th>
                <th scope="col">{t('aboutExam.colPurpose')}</th>
                <th scope="col">{t('aboutExam.colSubjects')}</th>
                <th scope="col">{t('aboutExam.colLevel')}</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <th scope="row">{exam.name}</th>
                  <td data-label={t('aboutExam.conductingAuthorityTitle')}>{exam.comparison.authority}</td>
                  <td data-label={t('aboutExam.colPurpose')}>{examText(exam.id, 'cmpPurpose')}</td>
                  <td data-label={t('aboutExam.colSubjects')}>{examText(exam.id, 'cmpSubjects')}</td>
                  <td data-label={t('aboutExam.colLevel')}>{examText(exam.id, 'cmpLevel')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      <section className="landing-section about-exam-which-section">
        <Reveal as="h2">{t('aboutExam.whichTitle')}</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={40}>
          {t('aboutExam.whichSubtitle')}
        </Reveal>
        <div className="about-exam-which-grid">
          {exams.map((exam, index) => (
            <Reveal as="article" className="about-exam-which-card" key={exam.id} delay={index * 90}>
              <span className="about-exam-icon" aria-hidden="true">
                <exam.Icon />
              </span>
              <h3>{exam.id === 'kcet' ? 'KCET' : exam.name}</h3>
              <p>{examText(exam.id, 'whichExamText')}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className="landing-section about-exam-disclaimer-section">
        <p className="about-exam-disclaimer">
          {t('aboutExam.disclaimer')}
        </p>
        <button
          className="solid-btn btn-with-arrow about-exam-back-bottom"
          type="button"
          onClick={() => navigate('/')}
        >
          {t('common.backToHome')}
          <ArrowRightIcon className="btn-arrow" />
        </button>
      </Reveal>

      <div className="landing-footer-wrap">
        <Footer />
      </div>
    </div>
  );
};

export default AboutExamPage;