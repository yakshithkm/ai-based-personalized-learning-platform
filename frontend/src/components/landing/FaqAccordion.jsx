import { useState } from 'react';

const FaqAccordion = ({ items }) => {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="faq-list">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const panelId = `faq-panel-${index}`;
        const buttonId = `faq-button-${index}`;

        return (
          <div className={`faq-item ${isOpen ? 'is-open' : ''}`} key={item.question}>
            <button
              type="button"
              id={buttonId}
              className="faq-question"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
            >
              {item.question}
              <span className="faq-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="16" height="16">
                  <path
                    d="M5 12h14M12 5v14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </button>
            {/* CSS grid-template-rows 0fr -> 1fr trick: animates height smoothly
                without measuring scrollHeight in JS, and naturally handles
                content of any length (including reflow on resize). */}
            <div className="faq-answer-collapse" aria-hidden={!isOpen}>
              <div id={panelId} role="region" aria-labelledby={buttonId} className="faq-answer">
                <p>{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FaqAccordion;