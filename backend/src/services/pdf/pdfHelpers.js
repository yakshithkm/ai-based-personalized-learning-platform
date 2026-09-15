const path = require('path');

const BRAND = {
  primary: '#2563eb',
  primaryDark: '#1e3a8a',
  text: '#0f172a',
  muted: '#475569',
  border: '#cbd5e1',
  success: '#15803d',
  danger: '#b91c1c',
  panel: '#f1f5f9',
};

const PAGE_MARGIN = 50;

const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'tutormind-logo.png');

/**
 * Draws the TutorMind logo, large and very low-opacity, centered on the CURRENT page
 * as a watermark. Callers are responsible for drawing it at the right moment (before
 * foreground content, so it sits underneath) and for repeating it on every page of a
 * multi-page document - see `watermarkAllPages` below for the common case.
 */
const drawWatermark = (doc, { opacity = 0.045, sizeFraction = 0.48 } = {}) => {
  const { width, height } = doc.page;
  const size = Math.min(width, height) * sizeFraction;
  doc.opacity(opacity);
  doc.image(LOGO_PATH, width / 2 - size / 2, height / 2 - size / 2, {
    fit: [size, size],
    align: 'center',
    valign: 'center',
  });
  doc.opacity(1);
};

/**
 * Watermarks the current page and registers a listener so every subsequently added
 * page (whether from an explicit doc.addPage() or pdfkit's own automatic pagination
 * when text overflows) gets the same treatment - useful for documents like the exam
 * report where the final page count isn't known up front.
 */
const watermarkAllPages = (doc, options) => {
  drawWatermark(doc, options);
  doc.on('pageAdded', () => drawWatermark(doc, options));
};

// pdfkit's built-in "standard 14" fonts (Helvetica, Times-*, Courier) only support the
// WinAnsiEncoding subset - roughly Latin-1. Any question/option text containing a micro
// sign (μ), an en/em dash, a combining overline (v̄), a root sign (√), or any other
// character outside that subset silently renders as garbled glyphs with those fonts -
// this is exactly what produced corrupted-looking options in generated reports, even
// though the underlying question data was valid UTF-8 all along. Registering a real
// Unicode TTF family once per document and using it everywhere below avoids that whole
// class of bug for any character the font covers (DejaVu Sans has very broad coverage:
// Latin Extended, Greek, general math symbols, and combining diacritics).
const FONT_PATHS = {
  regular: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'),
  bold: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf'),
  italic: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Oblique.ttf'),
  boldItalic: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-BoldOblique.ttf'),
  serifBoldItalic: require.resolve('dejavu-fonts-ttf/ttf/DejaVuSerif-BoldItalic.ttf'),
};

const FONT = {
  regular: 'PDFBody',
  bold: 'PDFBody-Bold',
  italic: 'PDFBody-Italic',
  boldItalic: 'PDFBody-BoldItalic',
  serifBoldItalic: 'PDFSerif-BoldItalic',
};

/**
 * Registers the Unicode-capable font family on a freshly created PDFDocument. Must be
 * called once, right after `new PDFDocument(...)`, before any `.font(FONT.*)` call.
 */
const registerFonts = (doc) => {
  doc.registerFont(FONT.regular, FONT_PATHS.regular);
  doc.registerFont(FONT.bold, FONT_PATHS.bold);
  doc.registerFont(FONT.italic, FONT_PATHS.italic);
  doc.registerFont(FONT.boldItalic, FONT_PATHS.boldItalic);
  doc.registerFont(FONT.serifBoldItalic, FONT_PATHS.serifBoldItalic);
};

/**
 * Moves to a new page if the next block of `height` points would not fit above the
 * bottom margin. Centralising this check is what lets every section below simply
 * "flow" without ever measuring the whole document up front.
 */
const ensureSpace = (doc, height) => {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + height > bottom) {
    doc.addPage();
  }
};

const drawDivider = (doc, { before = 6, after = 10 } = {}) => {
  doc.moveDown(before / 12);
  const y = doc.y;
  doc
    .save()
    .strokeColor(BRAND.border)
    .lineWidth(1)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke()
    .restore();
  doc.moveDown(after / 12);
};

const drawSectionTitle = (doc, title) => {
  ensureSpace(doc, 40);
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  // Explicit x/y here (rather than relying on doc.x/doc.y) matters: a section title
  // often follows drawKeyValueGrid, which leaves doc.x parked at whichever column it
  // last wrote to - without pinning back to the left margin, the title would silently
  // inherit that offset and render shifted right instead of flush-left.
  doc
    .fillColor(BRAND.primaryDark)
    .font(FONT.bold)
    .fontSize(14)
    .text(title, doc.page.margins.left, doc.y, { width: usableWidth, align: 'left' });
  doc.moveDown(0.35);
  doc.x = doc.page.margins.left;
  doc.fillColor(BRAND.text).font(FONT.regular).fontSize(10);
};

/**
 * Renders a label/value list as N columns of stacked rows (not a strict CSS grid - just
 * enough structure to keep the "Performance Summary" / certificate facts readable and
 * scannable rather than one long comma-separated line).
 */
const drawKeyValueGrid = (doc, pairs, { columns = 2 } = {}) => {
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usableWidth / columns;
  const rowHeight = 34;

  for (let i = 0; i < pairs.length; i += columns) {
    ensureSpace(doc, rowHeight);
    const rowY = doc.y;
    const rowItems = pairs.slice(i, i + columns);

    rowItems.forEach(([label, value], colIndex) => {
      const x = doc.page.margins.left + colIndex * colWidth;
      doc
        .font(FONT.regular)
        .fontSize(8.5)
        .fillColor(BRAND.muted)
        .text(String(label).toUpperCase(), x, rowY, { width: colWidth - 12 });
      doc
        .font(FONT.bold)
        .fontSize(11)
        .fillColor(BRAND.text)
        .text(value === null || value === undefined || value === '' ? '-' : String(value), x, rowY + 12, {
          width: colWidth - 12,
        });
    });

    doc.y = rowY + rowHeight;
  }
};

/**
 * A minimal, self-contained table renderer: fixed column widths, word-wrapped cells,
 * a light header band, and automatic page breaks between rows (a row is measured and,
 * if it would spill past the bottom margin, pushed to a fresh page rather than being
 * cut in half).
 */
const drawTable = (doc, { columns, rows, headerFill = BRAND.panel }) => {
  const startX = doc.page.margins.left;
  const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);

  const drawRow = (cells, { isHeader = false } = {}) => {
    const heights = cells.map((cellText, i) =>
      doc.font(isHeader ? FONT.bold : FONT.regular).fontSize(isHeader ? 9 : 9).heightOfString(String(cellText ?? '-'), {
        width: columns[i].width - 10,
      })
    );
    const rowHeight = Math.max(...heights, 16) + 10;

    ensureSpace(doc, rowHeight);
    const y = doc.y;

    if (isHeader) {
      doc.rect(startX, y, totalWidth, rowHeight).fill(headerFill);
    }

    let x = startX;
    cells.forEach((cellText, i) => {
      doc
        .fillColor(isHeader ? BRAND.primaryDark : BRAND.text)
        .font(isHeader ? FONT.bold : FONT.regular)
        .fontSize(9)
        .text(String(cellText ?? '-'), x + 5, y + 5, { width: columns[i].width - 10 });
      x += columns[i].width;
    });

    doc
      .save()
      .strokeColor(BRAND.border)
      .lineWidth(0.5)
      .moveTo(startX, y + rowHeight)
      .lineTo(startX + totalWidth, y + rowHeight)
      .stroke()
      .restore();

    doc.y = y + rowHeight;
  };

  drawRow(
    columns.map((col) => col.label),
    { isHeader: true }
  );
  rows.forEach((row) => drawRow(row));
};

/**
 * Adds "Page X of Y" to every buffered page. Requires the document to have been
 * created with `bufferPages: true` and called just before `doc.end()`.
 */
const addPageNumbers = (doc) => {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);

    // pdfkit auto-paginates text whose y falls at/beyond page.height - margins.bottom -
    // which is exactly where a footer belongs. Zeroing the bottom margin just for this
    // write lets us place text inside that reserved strip without silently spawning a
    // trailing blank page (the bug this comment is here to stop someone re-introducing).
    const originalBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const bottomY = doc.page.height - originalBottomMargin + 14;
    doc
      .fontSize(8)
      .fillColor(BRAND.muted)
      .font(FONT.regular)
      .text(`TutorMind Exam Simulation - Page ${i - range.start + 1} of ${range.count}`, doc.page.margins.left, bottomY, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
      });

    doc.page.margins.bottom = originalBottomMargin;
  }
};

module.exports = {
  BRAND,
  PAGE_MARGIN,
  FONT,
  registerFonts,
  drawWatermark,
  watermarkAllPages,
  ensureSpace,
  drawDivider,
  drawSectionTitle,
  drawKeyValueGrid,
  drawTable,
  addPageNumbers,
};