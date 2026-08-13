import JSZip from 'jszip';

// ─── Raw archive (unchanged) ──────────────────────────────────────────────────

export interface DocxArchive {
  zip: JSZip;
  /** Pre-parsed XML documents, keyed by zip path */
  xmlParts: Map<string, Document>;
  /** Raw XML strings (original bytes), keyed by zip path */
  rawXmlParts: Map<string, string>;
  /** Binary media files, keyed by zip path */
  mediaParts: Map<string, Uint8Array>;
  /** Relationship maps: partPath → RelEntry[] */
  relMaps: Map<string, RelEntry[]>;
}

export interface RelEntry {
  id: string;
  type: string;
  target: string;
  targetMode?: 'External' | 'Internal';
}

// ─── Stage 2: TemplateModel ───────────────────────────────────────────────────

export interface PageDimensions {
  widthTwips: number;
  heightTwips: number;
  orientation: 'portrait' | 'landscape';
}

export interface PageMargins {
  topTwips: number;
  rightTwips: number;
  bottomTwips: number;
  leftTwips: number;
  headerTwips: number;
  footerTwips: number;
  gutterTwips: number;
}

export interface SectionLayout {
  sectPrXml: string;
  differentFirstPage: boolean;
  differentOddEven: boolean;
  pageSize: PageDimensions;
  margins: PageMargins;
  sectionIndex: number;
}

export interface StyleDefinition {
  styleId: string;
  name: string;
  type: 'paragraph' | 'character' | 'table' | 'numbering';
  basedOn: string | null;
}

export interface NumberingDefinition {
  abstractNumId: number;
  concreteNums: Array<{ numId: number }>;
}

export interface ThemeInfo {
  partPath: string;
}

export interface TemplatePatternModel {
  /** Array of raw <w:sectPr> XML strings extracted in template layout page order */
  layouts: string[];
  /** Total number of unique layout pages in the pattern */
  length: number;
}

export interface TemplateModel {
  /** document.xml raw string from the template */
  documentXmlRaw: string;
  /** styles.xml raw string */
  stylesXmlRaw: string;
  /** settings.xml raw string */
  settingsXmlRaw: string | null;
  /** numbering.xml raw string */
  numberingXmlRaw: string | null;
  /** fontTable.xml raw string */
  fontTableXmlRaw: string | null;
  /** webSettings.xml raw string */
  webSettingsXmlRaw: string | null;
  /** All header/footer part paths and their raw XML */
  headerFooterParts: Map<string, string>;
  /** Theme part paths */
  themePartPaths: string[];
  /** Style IDs defined in the template */
  definedStyleIds: Set<string>;
  /** Numbering numIds defined in the template */
  definedNumIds: Set<string>;
  /** Numbering abstractNumIds defined in the template */
  definedAbstractNumIds: Set<string>;
  /** Original document.xml.rels entries (NEVER reassigned) */
  documentRels: RelEntry[];
  /** Highest rel ID number found in template (for generating new non-conflicting IDs) */
  maxRelIdNumber: number;
  /** Namespace declarations found on the document root element */
  documentRootNamespaces: Record<string, string>;
  /** Sections detected in template */
  sections: SectionLayout[];
  /** Document-level sectPr (verbatim from template) — always the last item in body */
  documentSectPrXml: string;
  /** Has titlePg */
  titlePg: boolean;
  /** Has evenAndOddHeaders */
  evenAndOddHeaders: boolean;
  /**
   * All media file paths present in the template archive (e.g. word/media/logo.png).
   * Used by MergePlanner to avoid overwriting template media with data doc media.
   */
  templateMediaPaths: Set<string>;
  /**
   * Multi-page layout pattern descriptors extracted in order from template.
   * Enables cyclic repeating layout sequences (1, 1-2, 1-2-3, 1-N).
   */
  patternModel: TemplatePatternModel;
}

// ─── Stage 3: ContentModel ────────────────────────────────────────────────────

export interface DataContentNode {
  /** Raw XML string of this body child element (paragraph or table) */
  xmlString: string;
  kind: 'paragraph' | 'table' | 'sectionBreak' | 'other';
  /** rel IDs referenced inside this XML string (r:id, r:embed, r:link values) */
  referencedRelIds: string[];
  /** style IDs referenced inside this XML string */
  referencedStyleIds: string[];
  /** numId values referenced inside this XML string */
  referencedNumIds: string[];
}

export interface ContentModel {
  sourceFileName: string;
  sourceIndex: number;
  /** Body content nodes as raw XML strings */
  nodes: DataContentNode[];
  /** Styles from this document — raw XML strings */
  rawStyles: string[];
  /** Style IDs defined in this document */
  definedStyleIds: Map<string, string>; // styleId → raw xml string
  /** abstractNum elements as raw XML strings */
  rawAbstractNums: string[];
  /** num elements as raw XML strings */
  rawNums: string[];
  /** abstractNumId → abstractNumId for the concrete nums referencing it */
  numAbstractMap: Map<number, number>; // numId → abstractNumId
  /** All rel entries from this document's .rels */
  documentRels: RelEntry[];
  /** Footnote elements as raw XML strings (keyed by id) */
  footnotes: Map<string, string>;
  /** Endnote elements as raw XML strings (keyed by id) */
  endnotes: Map<string, string>;
  /** Comment elements as raw XML strings (keyed by id) */
  comments: Map<string, string>;
  /** Bookmark entries: id → name */
  bookmarks: Map<string, string>;
  /** Media blobs keyed by full path (e.g. word/media/image1.png) */
  media: Map<string, Uint8Array>;
  /** Estimated page count (advisory only) */
  estimatedPageCount: number;
  /**
   * Raw <w:docDefaults>...</w:docDefaults> XML from this document's styles.xml.
   * Used by MergeEngine to replace template docDefaults (Fix 2: source doc controls typography).
   */
  docDefaultsXml: string | null;
}

// ─── Stage 4: MergeConstraints ────────────────────────────────────────────────

export type ConstraintStrategy =
  | 'resize-images'
  | 'reduce-paragraph-spacing'
  | 'reduce-line-spacing'
  | 'reduce-table-padding'
  | 'reduce-font-size';

export type TemplateScope =
  | 'all'
  | 'first-page'
  | 'last-page'
  | 'odd-pages'
  | 'even-pages';

export type StyleConflictRule = 'prefer-template' | 'prefer-data' | 'auto-rename';
export type HeaderFooterRule = 'use-template' | 'use-data' | 'ignore-data';
export type PageBreakRule = 'preserve' | 'remove' | 'after-sections' | 'keep-together';
export type ImageHandling = 'preserve' | 'fit-margins' | 'scale-proportional';
export type TableHandling = 'preserve' | 'auto-fit';

export interface UserConstraints {
  templateScope: TemplateScope;
  pageLimitEnabled: boolean;
  maxPages: number;
  constraintStrategies: ConstraintStrategy[];
  minFontSizePt: number;
  maxFontSizePt: number;
  imageHandling: ImageHandling;
  maxImageWidthEmu: number;
  maxImageHeightEmu: number;
  minImageScalePercent: number;
  tableHandling: TableHandling;
  preventRowSplitting: boolean;
  repeatHeaderRows: boolean;
  styleConflictRule: StyleConflictRule;
  headerFooterRule: HeaderFooterRule;
  pageBreakRule: PageBreakRule;
  insertSectionBreakBetweenDocs: boolean;
  sectionBreakType: 'nextPage' | 'continuous' | 'evenPage' | 'oddPage';
}

export interface ConstraintConflict {
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface PageEstimate {
  estimatedPages: number;
  disclaimer: string;
}

export interface MergeConstraints {
  userConstraints: UserConstraints;
  pageEstimate: PageEstimate;
  conflicts: ConstraintConflict[];
}

// ─── Stage 5: MergePlan ───────────────────────────────────────────────────────

/**
 * A MergeItem represents one XML string to inject into the body,
 * along with the substitutions to apply to it before injection.
 */
export interface MergeItem {
  sourceDocIdx: number;
  xmlString: string;
  /** Substitutions: [oldToken, newToken][] — applied as simple string.replaceAll */
  substitutions: Array<[string, string]>;
}

export interface RelAddition {
  newId: string;
  type: string;
  target: string;
  targetMode?: 'External' | 'Internal';
  mediaPath?: string;   // if image: full path e.g. word/media/image1.png
  mediaData?: Uint8Array;
}

export interface StyleAddition {
  /** Raw XML string for the <w:style> element */
  xmlString: string;
  styleId: string;
}

export interface NumberingAddition {
  abstractNumXml: string;
  numXml: string;
  newAbstractId: number;
  newNumId: number;
}

export interface FootnoteAddition {
  xmlString: string;
  newId: string;
}

export interface MergePlan {
  /** Ordered list of XML items to inject into the body (before final sectPr) */
  mergeItems: MergeItem[];
  /** New relationship entries to add to document.xml.rels */
  relAdditions: RelAddition[];
  /** New styles to add to styles.xml */
  styleAdditions: StyleAddition[];
  /** New numbering to add to numbering.xml */
  numberingAdditions: NumberingAddition[];
  /** New footnotes to add to footnotes.xml */
  footnoteAdditions: FootnoteAddition[];
  /** New endnotes to add to endnotes.xml */
  endnoteAdditions: FootnoteAddition[];
  /** New comments to add to comments.xml */
  commentAdditions: FootnoteAddition[];
  /** Need to write numbering.xml (template had none but data has some) */
  needsNumberingPart: boolean;
  /** Need to write footnotes.xml */
  needsFootnotesPart: boolean;
  /** Need to write endnotesPart */
  needsEndnotesPart: boolean;
  /** Need to write commentsPart */
  needsCommentsPart: boolean;
  /**
   * The first data document's <w:docDefaults> XML block.
   * Used by MergeEngine to replace template docDefaults so the source document
   * controls typography (default font, paragraph spacing, line spacing).
   */
  contentDocDefaultsXml: string | null;
  /**
   * The final section's <w:sectPr> XML string to be placed at the end of <w:body>.
   * Computed based on patternModel cyclic sequence.
   */
  finalSectPrXml: string;
}

// ─── Stage 7: DocumentModel ───────────────────────────────────────────────────

export interface DocumentModel {
  /** Final document.xml string */
  documentXml: string;
  /** Final styles.xml string */
  stylesXml: string;
  /** Final numbering.xml string (null if not needed) */
  numberingXml: string | null;
  /** settings.xml (from template, unchanged) */
  settingsXml: string | null;
  /** fontTable.xml (from template, unchanged) */
  fontTableXml: string | null;
  /** webSettings.xml (from template, unchanged) */
  webSettingsXml: string | null;
  /** Header parts: partPath → xml */
  headers: Map<string, string>;
  /** Footer parts: partPath → xml */
  footers: Map<string, string>;
  /** footnotes.xml */
  footnotesXml: string | null;
  /** endnotes.xml */
  endnotesXml: string | null;
  /** comments.xml */
  commentsXml: string | null;
  /** Final document.xml.rels entries */
  documentRels: RelEntry[];
  /** All media: full path → bytes */
  media: Map<string, Uint8Array>;
  /** Theme part paths (just the paths, from template) */
  themePartPaths: string[];
}

// ─── Stage 8: ValidationReport ───────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'repaired' | 'info';

export interface ValidationEntry {
  code: string;
  message: string;
  severity: ValidationSeverity;
  location?: string;
  autoRepaired?: boolean;
  repairDescription?: string;
}

export interface ValidationCheckResult {
  name: string;
  passed: boolean;
  entries: ValidationEntry[];
}

export interface ValidationReport {
  valid: boolean;
  checks: ValidationCheckResult[];
  entries: ValidationEntry[];
  errorCount: number;
  warningCount: number;
  repairedCount: number;
}

// ─── GenerationReport ─────────────────────────────────────────────────────────

export interface StrategyLogEntry {
  strategy: ConstraintStrategy;
  applied: boolean;
  changeCount: number;
  notes: string;
}

export interface GenerationReport {
  templateFileName: string;
  dataFileNames: string[];
  estimatedPages: number;
  sectionsDetected: number;
  stylesMerged: number;
  stylesAdded: number;
  relationshipsAdded: number;
  imagesCopied: number;
  footnotesCopied: number;
  endnotesCopied: number;
  commentsCopied: number;
  validationReport: ValidationReport;
  strategyLog: StrategyLogEntry[];
  constraintConflicts: ConstraintConflict[];
  durationMs: number;
  generatedAt: string;
  status: 'success' | 'success-with-warnings' | 'failed';
}

export interface GenerationResult {
  blob: Blob;
  fileName: string;
  report: GenerationReport;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export interface PipelineContext {
  // Inputs
  templateFile: File;
  dataFiles: File[];
  constraints: UserConstraints;
  onProgress: (phase: string, percent: number) => void;

  // Stage outputs
  templateArchive?: DocxArchive;
  dataArchives?: DocxArchive[];
  templateModel?: TemplateModel;
  contentModels?: ContentModel[];
  mergeConstraints?: MergeConstraints;
  mergePlan?: MergePlan;
  documentModel?: DocumentModel;
  validationReport?: ValidationReport;
  generationReport?: GenerationReport;
  outputBlob?: Blob;

  // Recovery log (accumulated across all stages)
  recoveryLog: ValidationEntry[];
}

export interface PipelineModule {
  readonly name: string;
  execute(ctx: PipelineContext): Promise<PipelineContext>;
}

// ─── Default constraints ──────────────────────────────────────────────────────

export const DEFAULT_CONSTRAINTS: UserConstraints = {
  templateScope: 'all',
  pageLimitEnabled: false,
  maxPages: 10,
  constraintStrategies: [
    'resize-images',
    'reduce-paragraph-spacing',
    'reduce-line-spacing',
    'reduce-table-padding',
    'reduce-font-size',
  ],
  minFontSizePt: 8,
  maxFontSizePt: 72,
  imageHandling: 'fit-margins',
  maxImageWidthEmu: 5486400,
  maxImageHeightEmu: 7315200,
  minImageScalePercent: 25,
  tableHandling: 'auto-fit',
  preventRowSplitting: false,
  repeatHeaderRows: true,
  styleConflictRule: 'prefer-template',
  headerFooterRule: 'use-template',
  pageBreakRule: 'preserve',
  insertSectionBreakBetweenDocs: true,
  sectionBreakType: 'nextPage',
};
