import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const BrandLogo = ({
  to = '/',
  className = '',
  text = 'TutorMind',
  withText = true,
  imageClassName = 'brand-mark',
  textClassName = 'brand-text',
  onClick,
}) => {
  const { t } = useTranslation();
  return (
    <Link className={`brand-link ${className}`.trim()} to={to} onClick={onClick}>
      <img className={imageClassName} src="/tutormind-logo.png" alt={t('common.logoAlt')} />
      {withText && <span className={textClassName}>{text}</span>}
    </Link>
  );
};

export default BrandLogo;
