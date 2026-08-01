import { Link } from 'react-router-dom';

const BrandLogo = ({
  to = '/',
  className = '',
  text = 'TutorMind',
  withText = true,
  imageClassName = 'brand-mark',
  textClassName = 'brand-text',
}) => {
  return (
    <Link className={`brand-link ${className}`.trim()} to={to}>
      <img className={imageClassName} src="/tutormind-logo.png" alt="TutorMind logo" />
      {withText && <span className={textClassName}>{text}</span>}
    </Link>
  );
};

export default BrandLogo;
