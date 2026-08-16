import { useNavigate } from 'react-router-dom';
import EmptyState from '../components/EmptyState';

const FlashcardsPage = () => {
  const navigate = useNavigate();

  return (
    <div className="page-grid">
      <section className="panel">
        <h2>Flashcards</h2>
        <p>Quick-fire spaced-repetition review cards for formulas, definitions, and reactions.</p>
      </section>

      <EmptyState
        icon="practice"
        title="Flashcards are coming soon"
        description="This feature needs a bit more building on our end before it's ready — we didn't want to ship a fake deck of cards in the meantime. In the meantime, Mistake Bank gives you spaced-repetition review on questions you've actually gotten wrong."
        actionLabel="Open Mistake Bank"
        onAction={() => navigate('/mistake-bank')}
      />
    </div>
  );
};

export default FlashcardsPage;