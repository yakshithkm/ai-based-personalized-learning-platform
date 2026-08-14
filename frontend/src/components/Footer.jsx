import BrandLogo from './BrandLogo';
import Reveal from './landing/Reveal';

const footerColumns = [
  {
    title: 'Product',
    links: [
      { label: 'Dashboard', href: '/dashboard' },
      { label: 'Practice', href: '/practice' },
      { label: 'Exam Simulation', href: '/exam-simulation' },
      { label: 'Analytics', href: '/analytics' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Study Roadmap', href: '/practice' },
      { label: 'Weak Topic Analysis', href: '/analytics' },
      { label: 'Mistake Review', href: '/practice' },
      { label: 'Help Center', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Contact', href: '#' },
      { label: 'Careers', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
    ],
  },
];

const socialLinks = [
  {
    label: 'Twitter',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 5.9c-.7.3-1.5.5-2.3.6.8-.5 1.4-1.3 1.7-2.3-.8.5-1.7.8-2.6 1a4.1 4.1 0 00-7 3.7A11.6 11.6 0 013 4.9a4.1 4.1 0 001.3 5.5c-.6 0-1.3-.2-1.8-.5v.1c0 2 1.4 3.6 3.3 4a4.2 4.2 0 01-1.9.1 4.1 4.1 0 003.9 2.9A8.3 8.3 0 012 18.4a11.6 11.6 0 006.3 1.9c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.2z" />
      </svg>
    ),
  },
  {
    label: 'LinkedIn',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3V9zm7 0h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.6c0-1.34-.02-3.07-1.87-3.07-1.87 0-2.16 1.46-2.16 2.97V21h-4V9z" />
      </svg>
    ),
  },
  {
    label: 'YouTube',
    href: '#',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M22 12s0-3.2-.4-4.7c-.24-.87-.93-1.55-1.8-1.8C18.3 5 12 5 12 5s-6.3 0-7.8.5c-.87.25-1.56.93-1.8 1.8C2 8.8 2 12 2 12s0 3.2.4 4.7c.24.87.93 1.55 1.8 1.8C5.7 19 12 19 12 19s6.3 0 7.8-.5c.87-.25 1.56-.93 1.8-1.8.4-1.5.4-4.7.4-4.7zM10 15.2V8.8l5.5 3.2-5.5 3.2z" />
      </svg>
    ),
  },
];

const Footer = ({ variant = 'full' }) => {
  const year = new Date().getFullYear();

  if (variant === 'minimal') {
    return (
      <footer className="app-footer app-footer-minimal">
        <span>
          © {year} TutorMind. All rights reserved. Built for focused exam preparation.
        </span>
      </footer>
    );
  }

  return (
    <footer className="app-footer">
      <div className="app-footer-grid">
        <Reveal as="div" className="app-footer-brand">
          <BrandLogo className="footer-brand" to="/dashboard" />
          <p>
            AI-powered personalized learning for NEET, JEE, and CET aspirants — practice smarter,
            track every weak spot, and walk into exam day ready.
          </p>
          <div className="app-footer-social">
            {socialLinks.map((social) => (
              <a key={social.label} href={social.href} aria-label={social.label}>
                {social.icon}
              </a>
            ))}
          </div>
        </Reveal>

        {footerColumns.map((column, index) => (
          <Reveal as="div" className="app-footer-col" key={column.title} delay={(index + 1) * 80}>
            <h5>{column.title}</h5>
            {column.links.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </Reveal>
        ))}
      </div>

      <div className="app-footer-bottom">
        <span>© {year} TutorMind. All rights reserved.</span>
        <span>Built for focused exam preparation.</span>
      </div>
    </footer>
  );
};

export default Footer;
