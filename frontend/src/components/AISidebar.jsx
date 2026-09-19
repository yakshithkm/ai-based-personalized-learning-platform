import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AIChatMessage from './AIChatMessage';

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6z" />
  </svg>
);

const SendIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 20v-6l8-2-8-2V4l19 8-19 8z" />
  </svg>
);

const MaximizeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M9 3H3v6h2V5h4zM15 3h6v6h-2V5h-4zM9 21H3v-6h2v4h4zM15 21h6v-6h-2v4h-4z" />
  </svg>
);

const MinimizeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 9V7h4V3h2v6zM21 9V7h-4V3h-2v6zM3 15v2h4v4h2v-6zM21 15v2h-4v4h-2v-6z" />
  </svg>
);

/**
 * The "Ask with AI" doubt-resolution sidebar for the Practice Page.
 *
 * This component is purely presentational/controlled - it owns only the
 * in-progress draft text. All conversation state (messages, loading, error)
 * and every question-navigation/reset rule lives in PracticePage, since that
 * page is what knows when the student has moved to a different question.
 *
 * Rendered via a portal directly into document.body rather than in place:
 * this component lives deep inside the app shell's grid (.app-shell >
 * .main-content > ...), and .main-content establishes its own stacking
 * context (position: relative + z-index: 1 in index.css). A fixed-position
 * child can never paint above a sibling of an ancestor's stacking context
 * no matter how high its own z-index is set - which is exactly why the
 * sidebar looked "docked below the header" instead of flush to the true
 * top-right corner. Portaling to document.body makes it a sibling of the
 * whole app shell instead of a descendant, so its own z-index is compared
 * directly against top-level page elements and `position: fixed` resolves
 * against the real viewport.
 */
const AISidebar = ({
  isOpen,
  question,
  messages,
  isLoading,
  error,
  streamingMessageId,
  onSendMessage,
  onClose,
  onRetryLast,
}) => {
  const [draft, setDraft] = useState('');
  // Purely a display preference (not conversation state), so it lives here
  // rather than in PracticePage - it isn't reset by question navigation and
  // doesn't need to be.
  const [isMaximized, setIsMaximized] = useState(false);
  const scrollRef = useRef(null);
  // "Busy" spans the whole request, not just the pre-first-token wait -
  // the student shouldn't be able to fire off a follow-up while a reply is
  // still streaming in.
  const isBusy = isLoading || !!streamingMessageId;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, error]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSend = () => {
    const text = draft.trim();
    if (!text || isBusy) return;
    onSendMessage(text);
    setDraft('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return createPortal(
    <>
      <div
        className={`ai-sidebar-backdrop ${isOpen ? 'ai-sidebar-backdrop-open' : ''}`}
        role="presentation"
        onClick={onClose}
      />
      <aside
        className={`ai-sidebar ${isOpen ? 'ai-sidebar-open' : ''} ${isMaximized ? 'ai-sidebar-maximized' : ''}`}
        role="complementary"
        aria-label="Ask with AI doubt resolution chat"
        aria-hidden={!isOpen}
      >
        <div className="ai-sidebar-head">
          <div>
            <h3>Ask with AI</h3>
            {question?.topic && (
              <p className="ai-sidebar-subtitle">
                {question.subject} · {question.topic}
              </p>
            )}
          </div>
          <div className="ai-sidebar-head-actions">
            <button
              type="button"
              className="ai-sidebar-maximize-btn"
              onClick={() => setIsMaximized((prev) => !prev)}
              aria-label={isMaximized ? 'Restore sidebar size' : 'Maximize sidebar'}
              aria-pressed={isMaximized}
              tabIndex={isOpen ? 0 : -1}
            >
              {isMaximized ? <MinimizeIcon /> : <MaximizeIcon />}
            </button>
            <button
              type="button"
              className="ai-sidebar-close-btn"
              onClick={onClose}
              aria-label="Close AI doubt resolution chat"
              tabIndex={isOpen ? 0 : -1}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="ai-sidebar-messages" ref={scrollRef} role="log" aria-live="polite">
          {messages.map((msg) => (
            <AIChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              isStreaming={msg.id === streamingMessageId}
            />
          ))}

          {isLoading && (
            <div className="ai-chat-msg ai-chat-msg-assistant ai-chat-typing">
              <span className="ai-chat-msg-label">AI</span>
              <p aria-label="AI is thinking">
                <span className="ai-typing-dot" />
                <span className="ai-typing-dot" />
                <span className="ai-typing-dot" />
              </p>
            </div>
          )}

          {!!error && (
            <div className="ai-chat-error">
              <p>{error}</p>
              <button type="button" className="outline-btn ai-chat-retry-btn" onClick={onRetryLast}>
                Try again
              </button>
            </div>
          )}
        </div>

        <div className="ai-sidebar-input-row">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a follow-up question..."
            rows={1}
            maxLength={1000}
            disabled={isBusy}
            tabIndex={isOpen ? 0 : -1}
            aria-label="Ask a follow-up question"
          />
          <button
            type="button"
            className="ai-sidebar-send-btn"
            onClick={handleSend}
            disabled={isBusy || !draft.trim()}
            aria-label="Send message"
            tabIndex={isOpen ? 0 : -1}
          >
            <SendIcon />
          </button>
        </div>
      </aside>
    </>,
    document.body
  );
};

export default AISidebar;