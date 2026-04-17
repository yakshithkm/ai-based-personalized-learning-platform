# CSS Classification Report (Prepared Before Separation)

Source scanned: `frontend/src/index.css`
Usage scanned: `frontend/src/**/*.jsx`
Total class selectors found: 186

## Global (layout, navbar, typography)

- `app-shell`, `sidebar`, `brand-wrap`, `brand`, `main-content`
- `user-block`, `user-avatar`, `user-name`, `user-email`
- `nav-menu`, `nav-icon`
- `page-grid`, `panel`, `error-text`
- `solid-btn`, `outline-btn`
- `brand-link`, `brand-mark`, `brand-text`
- `center-screen`
- Landing/public shell: `landing-*`, `feature-*`, `step-*`, `hero-*`, `horizon-*`

## Shared Components (used in multiple features/pages)

- `option-list`, `option-btn` (+ states)
  - used by ExamSimulationPage and PracticePage
- `feedback-*`, `correct-answer-text`, `improvement-tip`, `why-wrong-text`, `xp-pop`
  - used by Practice flow and related feedback UI
- `progress-tag`, `progress-bar`, `progress-fill`
  - used in dashboard/practice
- `chip`, `chip-wrap`, `ai-chip`, `ai-meta-box`
  - used across analytics/practice
- `nav-badge` (renamed from `exam-tag`)
  - used in global Layout navbar

## Feature-Specific (confirmed isolated)

### Exam feature (ExamSimulationPage + ExamSimulationResultPage)
- `exam-setup-grid`, `exam-toggle-row`
- `exam-live-header`, `exam-timer`, `exam-meta-row`
- `progress-pill`
- `exam-question-card`, `question-transition`, `exam-question-text`, `exam-mode-note`
- `exam-question-tags`, `exam-tag-chip`
- `exam-action-row`
- `palette-grid`, `palette-btn`, `palette-number`, `palette-state`, `palette-review-flag`
- `exam-score-grid`, `score-box`, `exam-result-split`, `exam-interpretation-box`

### Practice feature
- No class selector is currently proven practice-only.
- Practice page currently composes shared classes.

## Ambiguity / Risk Notes

- Previous assumption that `.option-*` was exam-only is incorrect.
- `.exam-tag` name was misleading because it is used in global Layout; renamed safely to `.nav-badge`.
- This phase is non-destructive: no removals were done.
