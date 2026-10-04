import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import EmptyState from '../components/EmptyState';

const FlashcardsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>{t('navigation.flashcards')}</h2>
        <p>{t('flashcards.intro')}</p>
      </section>

      <EmptyState
        icon="practice"
        title={t('flashcards.comingSoonTitle')}
        description={t('flashcards.comingSoonText')}
        actionLabel={t('flashcards.openMistakeBank')}
        onAction={() => navigate('/mistake-bank')}
      />
    </div>
  );
};

export default FlashcardsPage;