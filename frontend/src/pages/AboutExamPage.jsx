import { useNavigate } from 'react-router-dom';
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
    purpose:
      'NEET-UG is the common entrance examination for undergraduate medical education in India, and also applies to specified AYUSH and other covered medical-related undergraduate admissions under the applicable rules.',
    uses: [
      'Undergraduate medical admissions',
      'MBBS',
      'BDS',
      'Relevant AYUSH undergraduate courses such as BAMS, BUMS and BSMS',
      'Other applicable medical education admissions per current regulations',
    ],
    subjects: ['Physics', 'Chemistry', 'Biology'],
    whoText:
      'Students targeting undergraduate medical and covered healthcare-related programs should check NEET-UG requirements for their intended course.',
    links: {
      website: { label: 'Official Website', url: 'https://neet.nta.nic.in/' },
      apply: { label: 'Apply / Candidate Portal', url: 'https://neet.nta.nic.in/' },
      notices: { label: 'Official Notices', url: 'https://neet.nta.nic.in/public-notices/' },
    },
    noticeSummary: 'Registration windows, admit cards, and exam-day circulars are published here as they go live.',
    comparison: {
      authority: 'NTA',
      purpose: 'Medical/health-related undergraduate admissions',
      subjects: 'Physics, Chemistry, Biology',
      level: 'National',
    },
    whichExamText:
      'Choose NEET if your target courses require NEET-UG qualification, particularly undergraduate medical and covered healthcare-related programs.',
  },
  {
    id: 'jee',
    name: 'JEE Main',
    fullName: 'Joint Entrance Examination (Main)',
    authority: 'National Testing Agency (NTA)',
    Icon: CalculatorIcon,
    purpose:
      'JEE Main is used primarily for admission-related purposes to undergraduate engineering and architecture/planning programs, as specified by the relevant institutions and admission authorities.',
    uses: [
      'B.E. / B.Tech admissions',
      'B.Arch admissions',
      'B.Planning admissions',
      'Eligibility/qualification pathway for JEE Advanced where applicable',
      'Admissions to participating institutions according to their rules',
    ],
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    subjectsNote: 'Paper 1 (B.E. / B.Tech). Paper 2A covers B.Arch and Paper 2B covers B.Planning.',
    whoText:
      'Students targeting engineering, architecture, or planning pathways that use JEE Main should check its eligibility and admission requirements.',
    links: {
      website: { label: 'Official Website', url: 'https://jeemain.nta.nic.in/' },
      apply: { label: 'Apply / Candidate Portal', url: 'https://jeemain.nta.nic.in/' },
      notices: { label: 'Official Notices', url: 'https://jeemain.nta.nic.in/documents/' },
    },
    noticeSummary: 'Session dates, information bulletins, and official documents are published here as they go live.',
    comparison: {
      authority: 'NTA',
      purpose: 'Engineering/Architecture/Planning admissions',
      subjects: 'Physics, Chemistry, Mathematics',
      level: 'National',
    },
    whichExamText:
      'Choose JEE Main if you are targeting engineering, architecture or planning pathways that use JEE Main.',
  },
  {
    id: 'kcet',
    name: 'Karnataka CET (KCET / UGCET)',
    fullName: 'Karnataka Undergraduate Common Entrance Test',
    authority: 'Karnataka Examinations Authority (KEA)',
    Icon: MapPinIcon,
    purpose:
      'KCET/UGCET is a Karnataka state-level entrance examination used for admission to various professional undergraduate courses according to KEA rules.',
    uses: [
      'Engineering / B.E. / B.Tech',
      'Pharmacy',
      'Agriculture and allied courses',
      'Veterinary-related admissions',
      'Other professional undergraduate courses covered by KEA',
    ],
    subjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology'],
    subjectsNote:
      'Mathematics is required for engineering courses and Biology for pharmacy/agriculture/veterinary courses — subject requirements differ depending on the course.',
    whoText:
      'Students targeting professional undergraduate admissions in Karnataka through KEA should check KCET/UGCET requirements for their intended course.',
    links: {
      website: { label: 'KEA Official Website', url: 'https://cetonline.karnataka.gov.in/kea/' },
      apply: { label: 'KCET / UGCET Application', url: 'https://cetonline.karnataka.gov.in/kea/' },
      notices: { label: 'Official Notices / Information', url: 'https://cetonline.karnataka.gov.in/kea/' },
    },
    noticeSummary: 'Application cycles, eligibility rules, and admission-round updates are published here as they go live.',
    comparison: {
      authority: 'KEA',
      purpose: 'Karnataka professional undergraduate admissions',
      subjects: 'Depends on course, commonly PCM/PCB',
      level: 'Karnataka',
    },
    whichExamText:
      'Consider KCET if you are targeting professional undergraduate admissions in Karnataka through KEA.',
  },
];

const StatusNote = () => (
  <p className="exam-status-note">
    <CalendarIcon aria-hidden="true" />
    Check the official website for the current registration status.
  </p>
);

const OfficialLinkButton = ({ href, children, variant = 'outline' }) => (
  <a
    className={variant === 'solid' ? 'solid-btn' : 'outline-btn'}
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    aria-label={`${children} (opens the official site in a new tab)`}
  >
    {children} ↗
  </a>
);

const AboutExamPage = () => {
  const navigate = useNavigate();

  return (
    <div className="landing-page about-exam-page">
      <div className="landing-noise" aria-hidden="true" />

      <header className="landing-topbar about-exam-topbar">
        <BrandLogo className="landing-logo" to="/" />
        <span />
        <button
          type="button"
          className="outline-btn about-exam-back-top"
          onClick={() => navigate('/')}
        >
          <ArrowLeftIcon />
          <span>Back to Home</span>
        </button>
      </header>

      <section className="landing-section about-exam-header">
        <Reveal as="span" className="section-eyebrow about-exam-badge">
          EXAM INFORMATION
        </Reveal>
        <Reveal as="h1" delay={40}>
          About Entrance Exams
        </Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={80}>
          Understand NEET, JEE and Karnataka CET, their purpose, applications, and official
          updates.
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
                <strong>Conducting authority:</strong> {exam.authority}
              </p>

              <p className="about-exam-purpose">{exam.purpose}</p>

              <h3>Applications / Uses</h3>
              <ul className="about-exam-list">
                {exam.uses.map((use) => (
                  <li key={use}>{use}</li>
                ))}
              </ul>

              <h3>Subjects</h3>
              <ul className="about-exam-chip-list">
                {exam.subjects.map((subject) => (
                  <li key={subject} className="about-exam-chip">
                    {subject}
                  </li>
                ))}
              </ul>
              {exam.subjectsNote && <p className="about-exam-subjects-note">{exam.subjectsNote}</p>}

              <div className="about-exam-who">
                <h3>Who should consider {exam.id === 'kcet' ? 'KCET' : exam.name}?</h3>
                <p>{exam.whoText}</p>
              </div>

              <div className="about-exam-links">
                <h3>Official Links</h3>
                <div className="about-exam-link-row">
                  <OfficialLinkButton href={exam.links.website.url} variant="solid">
                    {exam.links.website.label}
                  </OfficialLinkButton>
                  <OfficialLinkButton href={exam.links.apply.url}>
                    {exam.links.apply.label}
                  </OfficialLinkButton>
                  <OfficialLinkButton href={exam.links.notices.url}>
                    {exam.links.notices.label}
                  </OfficialLinkButton>
                </div>
                <StatusNote />
                <p className="about-exam-leaving-note">
                  Official links open the examination authority&apos;s own website in a new tab.
                </p>
              </div>

              <div className="about-exam-notice">
                <h3>
                  <NoticeIcon aria-hidden="true" />
                  Latest Official Update
                </h3>
                <p>
                  Exam dates, registration windows, and eligibility rules can change at any time.
                  {' '}
                  {exam.noticeSummary}
                </p>
                <a
                  className="about-exam-notice-link"
                  href={exam.links.notices.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Official Notice
                  <ExternalLinkIcon aria-hidden="true" />
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="landing-section about-exam-comparison-section">
        <Reveal as="h2">Quick Comparison</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={40}>
          A quick side-by-side look at what each exam is for.
        </Reveal>

        <Reveal as="div" delay={80} className="about-exam-table-wrap">
          <table className="about-exam-table">
            <thead>
              <tr>
                <th scope="col">Exam</th>
                <th scope="col">Conducting Authority</th>
                <th scope="col">Main Purpose</th>
                <th scope="col">Major Subjects</th>
                <th scope="col">Level</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <th scope="row">{exam.name}</th>
                  <td data-label="Conducting Authority">{exam.comparison.authority}</td>
                  <td data-label="Main Purpose">{exam.comparison.purpose}</td>
                  <td data-label="Major Subjects">{exam.comparison.subjects}</td>
                  <td data-label="Level">{exam.comparison.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </section>

      <section className="landing-section about-exam-which-section">
        <Reveal as="h2">Which Exam Should I Prepare For?</Reveal>
        <Reveal as="p" className="landing-section-subtext" delay={40}>
          Purely informational — no one exam is better than another; it depends on your target
          courses.
        </Reveal>
        <div className="about-exam-which-grid">
          {exams.map((exam, index) => (
            <Reveal as="article" className="about-exam-which-card" key={exam.id} delay={index * 90}>
              <span className="about-exam-icon" aria-hidden="true">
                <exam.Icon />
              </span>
              <h3>{exam.id === 'kcet' ? 'KCET' : exam.name}</h3>
              <p>{exam.whichExamText}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className="landing-section about-exam-disclaimer-section">
        <p className="about-exam-disclaimer">
          Exam dates, eligibility, application deadlines and admission rules may change. Always
          verify the latest information on the official examination authority website.
        </p>
        <button
          className="solid-btn btn-with-arrow about-exam-back-bottom"
          type="button"
          onClick={() => navigate('/')}
        >
          Back to Home
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