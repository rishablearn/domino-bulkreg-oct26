const fs = require("fs");
const d = require("docx");
const { META, C } = require("./content.js");
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, AlignmentType, PageBreak, Header, Footer, PageNumber,
  TableOfContents, LevelFormat, ExternalHyperlink, VerticalAlign, TabStopType,
} = d;

const TEAL = "17707F", TEAL2 = "2EC0CB", NAVY = "0B1D3A", DARK = "14142B", ALT = "F7F7FC", LINE = "DCE6F0";
const FONT = "Arial", MONO = "Consolas";
const PAGE_W = 11906, MARGIN = 1134, CW = PAGE_W - 2 * MARGIN; // A4, 2 cm margins

// inline **bold** and `code`
function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const s = m[0];
    if (s.startsWith("**")) out.push(new TextRun({ text: s.slice(2, -2), bold: true, ...base }));
    else if (s.startsWith("`")) out.push(new TextRun({ text: s.slice(1, -1), font: MONO, color: "0F5FDC", ...base, size: (base.size || 21) - 1 }));
    else out.push(new TextRun({ text: s.slice(1, -1), italics: true, ...base }));
    last = m.index + s.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}

const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

function table(head, rows, widths) {
  const sum = widths.reduce((a, b) => a + b, 0);
  const w = widths.map((x) => Math.floor((x * CW) / sum));
  w[w.length - 1] += CW - w.reduce((a, b) => a + b, 0);
  const cell = (txt, i, hdr, alt) => new TableCell({
    borders, width: { size: w[i], type: WidthType.DXA },
    shading: { fill: hdr ? TEAL : alt ? ALT : "FFFFFF", type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    verticalAlign: VerticalAlign.TOP,
    children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: runs(String(txt), hdr ? { bold: true, color: "FFFFFF", size: 19 } : { size: 19 }) })],
  });
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: w,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((h, i) => cell(h, i, true)) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, i, false, ri % 2 === 1)) })),
    ],
  });
}

function callout(text, kind) {
  const color = kind === "warn" ? "B26B00" : kind === "done" ? "1A7F37" : TEAL;
  const fill = kind === "warn" ? "FFF6E5" : kind === "done" ? "EAF6EC" : "ECF3F8";
  const label = kind === "warn" ? "Caution: " : kind === "done" ? "Done when: " : "Note: ";
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [CW],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: CW, type: WidthType.DXA },
      borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.SINGLE, size: 24, color } },
      shading: { fill, type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 100, bottom: 100, left: 180, right: 140 },
      children: [new Paragraph({ children: [new TextRun({ text: label, bold: true, color }), ...runs(text)] })],
    })] })],
  });
}

function codeBlock(text) {
  return new Table({
    width: { size: CW, type: WidthType.DXA }, columnWidths: [CW],
    rows: [new TableRow({ cantSplit: true, children: [new TableCell({
      width: { size: CW, type: WidthType.DXA }, borders,
      shading: { fill: "F4F4F4", type: ShadingType.CLEAR, color: "auto" },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: text.split("\n").map((l) => new Paragraph({ spacing: { before: 0, after: 0, line: 240 }, children: [new TextRun({ text: l || " ", font: MONO, size: 16, color: DARK })] })),
    })] })],
  });
}

const spacer = () => new Paragraph({ spacing: { before: 0, after: 80 }, children: [] });

// ---------- body ----------
let listId = 0;
const numberingConfigs = [{ reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }];
const body = [];
let breakNext = false;
for (const b of C) {
  switch (b.t) {
    case "h1": body.push(new Paragraph({ heading: HeadingLevel.HEADING_1, pageBreakBefore: breakNext, children: [new TextRun(b.text)] })); breakNext = false; break;
    case "h2": body.push(new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(b.text)] })); break;
    case "h3": body.push(new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(b.text)] })); break;
    case "p": body.push(new Paragraph({ children: runs(b.text) })); break;
    case "bullets": b.items.forEach((it) => body.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: runs(it) }))); break;
    case "numbers": {
      const ref = "num" + (++listId);
      numberingConfigs.push({ reference: ref, levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 360 } } } }] });
      b.items.forEach((it) => body.push(new Paragraph({ numbering: { reference: ref, level: 0 }, children: runs(it) })));
      break;
    }
    case "table": body.push(table(b.head, b.rows, b.widths)); body.push(spacer()); break;
    case "code": body.push(codeBlock(b.text)); body.push(spacer()); break;
    case "note": body.push(callout(b.text, "note")); body.push(spacer()); break;
    case "warn": body.push(callout(b.text, "warn")); body.push(spacer()); break;
    case "done": body.push(callout(b.text, "done")); body.push(spacer()); break;
    case "pagebreak": breakNext = true; break;   // next H1 starts on a new page (no blank pages)
    case "refs": b.items.forEach(([t, u]) => body.push(new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [
      new TextRun({ text: t + " – " }), new ExternalHyperlink({ link: u, children: [new TextRun({ text: u, style: "Hyperlink", size: 18 })] })] }))); break;
  }
}

// ---------- cover ----------
const coverCell = (children, fill, h) => new TableRow({ height: { value: h, rule: "atLeast" }, children: [new TableCell({
  width: { size: CW, type: WidthType.DXA }, borders: { top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" }, right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" } },
  shading: { fill, type: ShadingType.CLEAR, color: "auto" }, margins: { top: 400, bottom: 400, left: 500, right: 500 }, children })] });
const W = (t, o = {}) => new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: t, color: "FFFFFF", ...o })] });
const cover = [
  new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: [CW], rows: [
    coverCell([W("HCL Software", { bold: true, size: 28 }), W("[ Place official HCLSW logo here ]", { size: 16, italics: true, color: "AAFFFF" })], NAVY, 1400),
    coverCell([
      W(META.title, { bold: true, size: 64 }),
      W(META.subtitle, { size: 30 }),
      new Paragraph({ spacing: { before: 300, after: 120 }, border: { top: { style: BorderStyle.SINGLE, size: 12, color: "36D6D9", space: 8 } }, children: [new TextRun({ text: META.docType, color: "FFFFFF", bold: true, size: 26 })] }),
    ], TEAL, 6200),
    coverCell([
      W("Version " + META.version + "  |  " + META.date + "  |  " + META.status, { size: 20 }),
      W("Author: " + META.author, { size: 20 }),
      W(META.classification, { size: 20, bold: true }),
    ], "1F8A99", 1600),
  ] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Contents")] }),
  new TableOfContents("Contents", { hyperlink: true, headingStyleRange: "1-2" }),
  new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: "If page numbers are missing, right-click the table of contents in Word and choose Update Field.", italics: true, size: 16, color: "5D6678" })] }),
  new Paragraph({ children: [new PageBreak()] }),
];

const doc = new Document({
  creator: META.author, title: META.title + " – " + META.docType, description: META.subtitle,
  features: { updateFields: true },
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: DARK } , paragraph: { spacing: { after: 120, line: 276 } } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 34, bold: true, font: FONT, color: TEAL }, paragraph: { spacing: { before: 120, after: 200 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: TEAL2, space: 4 } } } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: FONT, color: TEAL }, paragraph: { spacing: { before: 260, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: FONT, color: "0F5FDC" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: { config: numberingConfigs },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: 1134, bottom: 1134, left: MARGIN, right: MARGIN, header: 560, footer: 560 } }, titlePage: true },
    headers: {
      default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: TEAL2, space: 4 } },
        tabStops: [{ type: TabStopType.RIGHT, position: CW }],
        children: [new TextRun({ text: "HCL Software", bold: true, color: TEAL, size: 17 }), new TextRun({ text: "\t" + META.title + " – " + META.docType, color: "5D6678", size: 17 })] })] }),
      first: new Header({ children: [new Paragraph({ children: [] })] }),
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CW }],
        children: [new TextRun({ text: META.classification + "  |  v" + META.version, size: 16, color: "5D6678" }),
          new TextRun({ children: ["\tPage ", PageNumber.CURRENT, " of ", PageNumber.TOTAL_PAGES], size: 16, color: "5D6678" })] })] }),
      first: new Footer({ children: [new Paragraph({ children: [] })] }),
    },
    children: [...cover, ...body],
  }],
});

Packer.toBuffer(doc).then((buf) => { fs.writeFileSync(process.argv[2] || "out.docx", buf); console.log("written"); });
