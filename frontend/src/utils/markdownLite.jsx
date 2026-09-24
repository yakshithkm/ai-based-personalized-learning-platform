import React from 'react';

// Cleans up LaTeX-ish math notation (from the AI tutor) and plain-text
// subscript/superscript notation (from curated learning content) alike -
// there is no full math renderer here, so "$H_2O$", "\Delta H_{\text{mixing}}"
// and "x_A", "K_b", "n^m" all end up as real <sub>/<sup> (or Unicode digit
// sub/superscripts) instead of showing the raw underscores/braces/carets.
// Order matters: strip \text{...} wrappers and translate named Greek/math
// commands to Unicode FIRST, then convert what's left of subscript/
// superscript groups, then sweep up anything still unrecognized.
const SUBSCRIPT_DIGITS = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };
const SUPERSCRIPT_DIGITS = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };

const toSubscript = (digits) => digits.split('').map((d) => SUBSCRIPT_DIGITS[d] ?? d).join('');
const toSuperscript = (digits) => digits.split('').map((d) => SUPERSCRIPT_DIGITS[d] ?? d).join('');

// Named LaTeX commands mapped to their plain Unicode equivalents. Matched
// with a trailing word boundary so e.g. "\theta" doesn't also eat the start
// of some unrelated following word.
const LATEX_COMMAND_REPLACEMENTS = [
  [/\\rightarrow\b|\\to\b/g, ' → '],
  [/\\leftarrow\b/g, ' ← '],
  [/\\leftrightarrow\b/g, ' ↔ '],
  [/\\times\b/g, ' × '],
  [/\\div\b/g, ' ÷ '],
  [/\\pm\b/g, ' ± '],
  [/\\cdot\b/g, ' · '],
  [/\\leq\b/g, ' ≤ '],
  [/\\geq\b/g, ' ≥ '],
  [/\\neq\b/g, ' ≠ '],
  [/\\approx\b/g, ' ≈ '],
  [/\\infty\b/g, '∞'],
  [/\\partial\b/g, '∂'],
  [/\\sqrt\b/g, '√'],
  [/\\Delta\b/g, 'Δ'],
  [/\\delta\b/g, 'δ'],
  [/\\Sigma\b/g, 'Σ'],
  [/\\sigma\b/g, 'σ'],
  [/\\Omega\b/g, 'Ω'],
  [/\\omega\b/g, 'ω'],
  [/\\alpha\b/g, 'α'],
  [/\\beta\b/g, 'β'],
  [/\\gamma\b/g, 'γ'],
  [/\\pi\b/g, 'π'],
  [/\\theta\b/g, 'θ'],
  [/\\lambda\b/g, 'λ'],
  [/\\mu\b/g, 'μ'],
  [/\\phi\b/g, 'φ'],
  [/\\left/g, ''],
  [/\\right/g, ''],
];

export const sanitizeMathNotation = (text) => {
  let result = text || '';

  // \text{...} / \mathrm{...} / \mathbf{...} wrap plain words for LaTeX's
  // own formatting purposes - the wrapper never carries meaning here, so
  // just unwrap it and keep the inner text.
  result = result.replace(/\\(?:text|mathrm|mathbf|mathit)\{([^{}]*)\}/g, '$1');

  // \frac{a}{b} must become "a/b", not be silently dropped to "ab" by the
  // generic brace-stripping fallback below - losing the division sign
  // would change the actual meaning of a formula, not just its formatting.
  // Two passes handle one level of nested braces (e.g. \frac{a+b}{c}).
  const fracPattern = /\\frac\{([^{}]*)\}\{([^{}]*)\}/g;
  result = result.replace(fracPattern, '($1)/($2)').replace(fracPattern, '($1)/($2)');

  for (const [pattern, replacement] of LATEX_COMMAND_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }

  result = result
    // Digit-only sub/superscripts become real Unicode sub/superscript
    // characters (only digits have those in Unicode) - e.g. "H_2O", "x^2".
    .replace(/_\{(\d+)\}/g, (_, d) => toSubscript(d))
    .replace(/\^\{(\d+)\}/g, (_, d) => toSuperscript(d))
    .replace(/([A-Za-z)\]])_(\d+)/g, (_, prefix, d) => `${prefix}${toSubscript(d)}`)
    .replace(/([A-Za-z)\]])\^(\d+)/g, (_, prefix, d) => `${prefix}${toSuperscript(d)}`)
    // Plain-text (unbraced) letter-based sub/superscripts, e.g. "x_A", "K_b",
    // "R_total", "n^m" - Unicode has no general sub/superscript letters, so wrap
    // them as ~sub~ / ^sup^ tokens for applyInline to render as real <sub>/<sup>
    // (rather than leaving the underscore/caret visible as raw text). Must run
    // BEFORE the parenthesized-exponent rule below, since "^(" never matches this
    // (letters-only) pattern - so its ^...^ output is never re-wrapped by this rule.
    .replace(/([A-Za-z0-9)\]])_([A-Za-z][A-Za-z0-9]*)/g, (_, base, sub) => `${base}~${sub}~`)
    .replace(/([A-Za-z0-9)\]])\^([A-Za-z][A-Za-z0-9]*)/g, (_, base, sup) => `${base}^${sup}^`)
    // A parenthesized superscript exponent, e.g. "n^(mn)" - drop the now-redundant
    // parens; this is the LAST rule to touch ^, so its output is never re-matched.
    .replace(/\^\(([^()]+)\)/g, (_, inner) => `^${inner}^`)
    // Whatever's left of _{...}/^{...} is non-numeric (e.g. "_{mixing}"
    // after \text{mixing} was unwrapped above) - wrap it the same way so it
    // renders as a real <sub>/<sup> instead of showing braces literally.
    .replace(/_\{([^{}]+)\}/g, (_, inner) => `~${inner.trim()}~`)
    .replace(/\^\{([^{}]+)\}/g, (_, inner) => `^${inner.trim()}^`)
    // Any remaining backslash-prefixed command we didn't name above
    // (\frac, \sum, \int, stray \left/\right artifacts, etc.) - strip the
    // backslash and command name rather than let it show up as raw markup.
    .replace(/\\[a-zA-Z]+/g, '')
    // Leftover empty math delimiters/braces from any of the above.
    .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
    .replace(/[{}]/g, '')
    .replace(/\$+/g, '')
    // Collapse any double spaces the substitutions above introduced.
    .replace(/ {2,}/g, ' ');

  return result;
};

let inlineKeySeq = 0;

// Applies inline formatting (bold/italic/inline code) within one line of
// already math-sanitized text. Everything here becomes real JSX text
// nodes/elements - nothing goes through dangerouslySetInnerHTML, so there
// is no HTML-injection surface even though this is model-generated text.
const applyInline = (text) => {
  const nodes = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|~[^~]+~|\^[^^]+\^|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match = pattern.exec(text);

  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `inline-${inlineKeySeq++}`;
    if (token.startsWith('**')) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('`')) {
      nodes.push(<code key={key}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('~')) {
      nodes.push(<sub key={key}>{token.slice(1, -1)}</sub>);
    } else if (token.startsWith('^')) {
      nodes.push(<sup key={key}>{token.slice(1, -1)}</sup>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = pattern.lastIndex;
    match = pattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
};

const isListLine = (line) => /^[-*]\s+/.test(line.trim());
const isOrderedLine = (line) => /^\d+\.\s+/.test(line.trim());
const isHeadingLine = (line) => /^(#{1,4})\s+/.test(line);
const isHrLine = (line) => /^(-{3,}|\*{3,})$/.test(line.trim());
const isFenceLine = (line) => line.trim().startsWith('```');

/**
 * Renders a small, safe-by-construction subset of Markdown as React nodes:
 * headings, bold/italic/inline code, unordered/ordered lists, fenced code
 * blocks, horizontal rules, and paragraphs. Intentionally not a full
 * Markdown implementation - just enough to match what the system
 * instruction actually asks the model to produce.
 */
export const renderMiniMarkdown = (rawText) => {
  const text = sanitizeMathNotation(rawText);
  const lines = text.replace(/\r\n/g, '\n').split('\n');

  const blocks = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    if (isFenceLine(line)) {
      const codeLines = [];
      i += 1;
      while (i < lines.length && !isFenceLine(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1; // skip the closing fence
      blocks.push(
        <pre key={`b-${blockKey++}`}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    if (isHrLine(line)) {
      blocks.push(<hr key={`b-${blockKey++}`} />);
      i += 1;
      continue;
    }

    const headingMatch = line.match(/^(#{1,4})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      // Map Markdown h1-h4 to h4-h6 so headings stay visually modest inside
      // a narrow chat bubble rather than looking like page titles.
      const Tag = `h${Math.min(level + 3, 6)}`;
      blocks.push(React.createElement(Tag, { key: `b-${blockKey++}` }, applyInline(headingMatch[2])));
      i += 1;
      continue;
    }

    if (isListLine(line)) {
      const items = [];
      while (i < lines.length && isListLine(lines[i])) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={`b-${blockKey++}`}>
          {items.map((item, idx) => (
            <li key={idx}>{applyInline(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (isOrderedLine(line)) {
      const items = [];
      while (i < lines.length && isOrderedLine(lines[i])) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={`b-${blockKey++}`}>
          {items.map((item, idx) => (
            <li key={idx}>{applyInline(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // Paragraph: gather consecutive plain lines until a blank line or the
    // start of another block type.
    const paraLines = [line];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !isHeadingLine(lines[i]) &&
      !isListLine(lines[i]) &&
      !isOrderedLine(lines[i]) &&
      !isFenceLine(lines[i]) &&
      !isHrLine(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    blocks.push(<p key={`b-${blockKey++}`}>{applyInline(paraLines.join(' '))}</p>);
  }

  return blocks;
};