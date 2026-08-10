// ─── Office Open XML Namespace URIs ──────────────────────────────────────────

export const NS = {
  w:   'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
  r:   'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
  wp:  'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
  a:   'http://schemas.openxmlformats.org/drawingml/2006/main',
  pic: 'http://schemas.openxmlformats.org/drawingml/2006/picture',
  v:   'urn:schemas-microsoft-com:vml',
  mc:  'http://schemas.openxmlformats.org/markup-compatibility/2006',
  m:   'http://schemas.openxmlformats.org/officeDocument/2006/math',
  wpc: 'http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas',
  ct:  'http://schemas.openxmlformats.org/package/2006/content-types',
  pkg: 'http://schemas.openxmlformats.org/package/2006/relationships',
  dc:  'http://purl.org/dc/elements/1.1/',
  cp:  'http://schemas.openxmlformats.org/package/2006/metadata/core-properties',
  w14: 'http://schemas.microsoft.com/office/word/2010/wordml',
  w15: 'http://schemas.microsoft.com/office/word/2012/wordml',
} as const;

// ─── Content Type strings ─────────────────────────────────────────────────────

export const CONTENT_TYPES = {
  document:    'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
  styles:      'application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml',
  settings:    'application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml',
  numbering:   'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml',
  header:      'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml',
  footer:      'application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml',
  footnotes:   'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml',
  endnotes:    'application/vnd.openxmlformats-officedocument.wordprocessingml.endnotes+xml',
  comments:    'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
  theme:       'application/vnd.openxmlformats-officedocument.theme+xml',
  fontTable:   'application/vnd.openxmlformats-officedocument.wordprocessingml.fontTable+xml',
  webSettings: 'application/vnd.openxmlformats-officedocument.wordprocessingml.webSettings+xml',
  pngImage:    'image/png',
  jpegImage:   'image/jpeg',
  gifImage:    'image/gif',
  bmpImage:    'image/bmp',
  tiffImage:   'image/tiff',
  emfImage:    'image/x-emf',
  wmfImage:    'image/x-wmf',
  svgImage:    'image/svg+xml',
} as const;

// ─── Relationship Type URIs ───────────────────────────────────────────────────

export const REL_TYPES = {
  officeDocument: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument',
  styles:         'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles',
  settings:       'http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings',
  numbering:      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering',
  header:         'http://schemas.openxmlformats.org/officeDocument/2006/relationships/header',
  footer:         'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer',
  footnotes:      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes',
  endnotes:       'http://schemas.openxmlformats.org/officeDocument/2006/relationships/endnotes',
  comments:       'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',
  theme:          'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme',
  fontTable:      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/fontTable',
  image:          'http://schemas.openxmlformats.org/officeDocument/2006/relationships/image',
  hyperlink:      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink',
  chart:          'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart',
  oleObject:      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/oleObject',
  webSettings:    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/webSettings',
  customXml:      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml',
  diagramData:    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramData',
  diagramLayout:  'http://schemas.openxmlformats.org/officeDocument/2006/relationships/diagramLayout',
} as const;

// ─── Well-known part paths ────────────────────────────────────────────────────

export const PARTS = {
  document:    'word/document.xml',
  styles:      'word/styles.xml',
  settings:    'word/settings.xml',
  numbering:   'word/numbering.xml',
  footnotes:   'word/footnotes.xml',
  endnotes:    'word/endnotes.xml',
  comments:    'word/comments.xml',
  fontTable:   'word/fontTable.xml',
  webSettings: 'word/webSettings.xml',
  contentTypes: '[Content_Types].xml',
  rootRels:    '_rels/.rels',
  documentRels: 'word/_rels/document.xml.rels',
} as const;

// ─── Section break types ──────────────────────────────────────────────────────

export const SECT_BREAK_TYPES = {
  nextPage:   'nextPage',
  evenPage:   'evenPage',
  oddPage:    'oddPage',
  continuous: 'continuous',
  nextColumn: 'nextColumn',
} as const;

// ─── Relationship types that are "structural" (template-only, never from data) ─

export const STRUCTURAL_REL_TYPES = new Set([
  REL_TYPES.styles,
  REL_TYPES.settings,
  REL_TYPES.numbering,
  REL_TYPES.fontTable,
  REL_TYPES.webSettings,
  REL_TYPES.theme,
  REL_TYPES.footnotes,
  REL_TYPES.endnotes,
  REL_TYPES.comments,
  REL_TYPES.customXml,
]);
