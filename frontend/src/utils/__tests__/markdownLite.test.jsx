import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { renderMiniMarkdown, sanitizeMathNotation } from '../markdownLite';

describe('sanitizeMathNotation', () => {
  it('converts digit-only sub/superscripts to real Unicode characters', () => {
    expect(sanitizeMathNotation('H_2O')).toBe('H\u2082O');
    expect(sanitizeMathNotation('x^2')).toBe('x\u00B2');
    expect(sanitizeMathNotation('H_{2}O')).toBe('H\u2082O');
  });

  it('wraps plain-text letter-based subscripts/superscripts for real <sub>/<sup> rendering', () => {
    expect(sanitizeMathNotation('p_total = x_A p_A + x_B p_B')).toBe('p~total~ = x~A~ p~A~ + x~B~ p~B~');
  });

  it('never leaves a raw underscore/caret subscript or superscript visible', () => {
    const cases = [
      'p_total = x_A p_A\u00B0 + x_B p_B\u00B0.',
      '\u0394T_b = i K_b m, \u0394T_f = i K_f m, \u03C0 = i CRT.',
      'v_d = I / (n e A)',
      'the number of functions from A to B is n^m.',
      'the number of relations from A to B is 2^(mn).',
    ];
    cases.forEach((text) => {
      const out = sanitizeMathNotation(text);
      expect(out).not.toMatch(/[A-Za-z0-9)\]]_[A-Za-z]/);
      expect(out).not.toMatch(/\^\(/);
    });
  });

  it('does not double-wrap an already-closed superscript token', () => {
    expect(sanitizeMathNotation('the number of relations from A to B is 2^(mn).')).toBe(
      'the number of relations from A to B is 2^mn^.'
    );
  });
});

describe('renderMiniMarkdown', () => {
  it('renders plain-text subscripts and superscripts as real <sub>/<sup> elements', () => {
    const { container } = render(<div>{renderMiniMarkdown('p_total = x_A p_A\u00B0 + x_B p_B\u00B0.')}</div>);
    const subs = container.querySelectorAll('sub');
    expect(Array.from(subs).map((el) => el.textContent)).toEqual(['total', 'A', 'A', 'B', 'B']);
    expect(container.textContent).not.toContain('_');
  });

  it('renders a caret-wrapped superscript as a real <sup> element', () => {
    const { container } = render(<div>{renderMiniMarkdown('the number of functions from A to B is n^m.')}</div>);
    expect(container.querySelector('sup')?.textContent).toBe('m');
    expect(container.textContent).not.toContain('^');
  });

  it('still renders digit sub/superscripts as plain Unicode characters (no <sub>/<sup> needed)', () => {
    const { container } = render(<div>{renderMiniMarkdown('H_2O and x^2')}</div>);
    expect(container.querySelector('sub')).toBeNull();
    expect(container.querySelector('sup')).toBeNull();
    expect(container.textContent).toContain('H\u2082O');
    expect(container.textContent).toContain('x\u00B2');
  });
});