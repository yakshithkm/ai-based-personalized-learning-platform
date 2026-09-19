import { renderMiniMarkdown } from '../utils/markdownLite';

const AIChatMessage = ({ role, content, isStreaming }) => (
  <div className={`ai-chat-msg ai-chat-msg-${role}`}>
    <span className="ai-chat-msg-label">{role === 'assistant' ? 'AI' : 'You'}</span>
    {role === 'assistant' ? (
      <div className="ai-chat-msg-body">
        {renderMiniMarkdown(content)}
        {/* Blinking cursor while chunks are still arriving - purely visual,
            not announced to screen readers since the message content
            itself already updates via aria-live="polite" on the log. */}
        {isStreaming && <span className="ai-chat-cursor" aria-hidden="true" />}
      </div>
    ) : (
      // The student's own text is shown as-is (just line breaks preserved
      // via CSS white-space) - no Markdown parsing, so a literal "*" or "#"
      // they typed is never misread as formatting.
      <p className="ai-chat-msg-plain">{content}</p>
    )}
  </div>
);

export default AIChatMessage;