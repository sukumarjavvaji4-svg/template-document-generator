import {
  DocxArchive, PipelineContext, PipelineModule, ContentModel,
  DataContentNode, RelEntry,
} from '../types';
import { PARTS, REL_TYPES } from '../utils/ooxml';
import { ArchiveParser } from './ArchiveParser';

// ─── Content Extractor ────────────────────────────────────────────────────────
// Stage 3: Reads data documents and produces ContentModel[].
//
// CRITICAL RULES:
// 1. All content is stored as raw XML strings — never as DOM nodes.
// 2. Uses DOMParser for correct element extraction (not the broken string splitter).
// 3. Strips <w:sectPr> from data paragraphs — they reference data-doc rels
//    that don't exist in the merged document and would create corrupted sections.
// 4. No XML modification. Pure extraction only.

const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

export class ContentExtractor implements PipelineModule {
  readonly name = 'ContentExtractor';

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    ctx.onProgress('Extracting content', 22);
    ctx.contentModels = [];
    for (let i = 0; i < ctx.dataArchives!.length; i++) {
      ctx.onProgress(
        `Extracting content ${i + 1}/${ctx.dataFiles.length}`,
        22 + (i / ctx.dataFiles.length) * 10
      );
      ctx.contentModels.push(
        this.extract(ctx.dataArchives![i], ctx.dataFiles[i].name, i)
      );
    }
    ctx.onProgress('Content extracted', 32);
    return ctx;
  }

  extract(arc: DocxArchive, fileName: string, sourceIndex: number): ContentModel {
    const documentXml = arc.rawXmlParts.get(PARTS.document) ?? '';
    const stylesXml = arc.rawXmlParts.get(PARTS.styles) ?? '';
    const numberingXml = arc.rawXmlParts.get(PARTS.numbering) ?? null;

    const documentRels = ArchiveParser.getRels(arc, PARTS.document);

    // ── 1. Extract body content via DOM ───────────────────────────────────
    const nodes = this._extractBodyNodes(documentXml);

    // ── 2. Extract styles ─────────────────────────────────────────────────
    const { rawStyles, definedStyleIds } = this._extractStyles(stylesXml);

    // ── 3. Extract docDefaults (Fix 2: source doc controls typography) ────
    const docDefaultsXml = this._extractDocDefaults(stylesXml);

    // ── 4. Extract numbering ──────────────────────────────────────────────
    const { rawAbstractNums, rawNums, numAbstractMap } = this._extractNumbering(numberingXml);

    // ── 5. Extract footnotes/endnotes/comments ────────────────────────────
    const footnotes = this._extractAnnotations(
      arc.rawXmlParts.get(PARTS.footnotes) ?? null, 'footnote'
    );
    const endnotes = this._extractAnnotations(
      arc.rawXmlParts.get(PARTS.endnotes) ?? null, 'endnote'
    );
    const comments = this._extractAnnotations(
      arc.rawXmlParts.get(PARTS.comments) ?? null, 'comment'
    );

    // ── 6. Extract bookmarks ──────────────────────────────────────────────
    const bookmarks = this._extractBookmarks(documentXml);

    // ── 7. Estimate page count (advisory only) ────────────────────────────
    const estimatedPageCount = Math.max(1, Math.ceil(nodes.length / 50));

    return {
      sourceFileName: fileName,
      sourceIndex,
      nodes,
      rawStyles,
      definedStyleIds,
      rawAbstractNums,
      rawNums,
      numAbstractMap,
      documentRels,
      footnotes,
      endnotes,
      comments,
      bookmarks,
      media: arc.mediaParts,
      estimatedPageCount,
      docDefaultsXml,
    };
  }

  // ─── Body extraction — DOM-based (correct) ────────────────────────────────
  //
  // WHY DOM-BASED:
  // The previous string-based `_splitTopLevelElements` searched for '/>' to detect
  // self-closing elements. But `body.indexOf('/>', i)` finds the FIRST '/>' in the
  // entire document from position i — this matches INNER self-closing elements like
  // <w:rPr/> inside <w:p>, causing the outer <w:p> to be truncated mid-element.
  // DOMParser handles this correctly because it understands the XML grammar.

  private _extractBodyNodes(documentXml: string): DataContentNode[] {
    const nodes: DataContentNode[] = [];
    const serializer = new XMLSerializer();

    let doc: Document;
    try {
      doc = new DOMParser().parseFromString(documentXml, 'application/xml');
    } catch {
      return nodes;
    }

    // Check for parse errors
    const parseError = doc.getElementsByTagName('parsererror')[0];
    if (parseError) return nodes;

    const body = doc.getElementsByTagNameNS(NS_W, 'body')[0];
    if (!body) return nodes;

    for (const child of Array.from(body.childNodes)) {
      // Only process element nodes (nodeType 1)
      if (child.nodeType !== 1) continue;
      const el = child as Element;

      // Skip the document-level <w:sectPr> (direct child of body)
      if (el.localName === 'sectPr' && el.namespaceURI === NS_W) continue;

      // Serialize the element from its own document context.
      // XMLSerializer produces fully namespace-qualified output — namespace
      // declarations are stripped later by MergeEngine._stripRedundantNamespaces.
      let xmlString = serializer.serializeToString(el);

      // ── Strip <w:sectPr> from data document paragraphs ────────────────
      // Data doc paragraphs may contain <w:sectPr> from the data doc's own
      // section structure. Those sectPr elements reference r:id values from
      // the data doc's relationship file (e.g. its headers/footers).
      // Those r:ids DON'T EXIST in the merged document.xml.rels.
      // Leaving them in creates corrupted sections with broken references.
      // We strip them here and let MergePlanner add proper section breaks.
      if (xmlString.includes('<w:sectPr') || xmlString.includes('sectPr')) {
        xmlString = this._stripSectPr(xmlString);
        // If stripping left an effectively empty paragraph, skip it
        if (this._isEmptyParagraph(xmlString)) continue;
      }

      // Skip if serialization produced nothing useful
      if (!xmlString || xmlString.trim().length < 5) continue;

      const kind = this._classifyElement(el);
      const referencedRelIds = this._findRelIds(xmlString);
      const referencedStyleIds = this._findStyleIds(xmlString);
      const referencedNumIds = this._findNumIds(xmlString);

      nodes.push({ xmlString, kind, referencedRelIds, referencedStyleIds, referencedNumIds });
    }

    return nodes;
  }

  private _classifyElement(el: Element): DataContentNode['kind'] {
    if (el.localName === 'p' && el.namespaceURI === NS_W) return 'paragraph';
    if (el.localName === 'tbl' && el.namespaceURI === NS_W) return 'table';
    return 'other';
  }

  /**
   * Remove ALL <w:sectPr> elements from an XML string.
   * Used to sanitize data-doc paragraphs whose internal section breaks
   * contain references (r:ids) that don't exist in the merged document.
   */
  private _stripSectPr(xml: string): string {
    // Remove self-closing: <w:sectPr ... />
    let result = xml.replace(/<w:sectPr\b[^>]*\/>/g, '');
    // Remove element with content: <w:sectPr ...>...</w:sectPr>
    // Use a loop to handle nested/multiple occurrences
    let prev = '';
    while (prev !== result) {
      prev = result;
      result = result.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, '');
    }
    return result;
  }

  /**
   * Check if a paragraph XML string is effectively empty
   * (no runs, no text, no meaningful content).
   */
  private _isEmptyParagraph(xml: string): boolean {
    if (!xml.includes('<w:p')) return false;
    // Has any run?
    if (xml.includes('<w:r>') || xml.includes('<w:r ')) return false;
    // Has hyperlink?
    if (xml.includes('<w:hyperlink')) return false;
    // Has drawing?
    if (xml.includes('<w:drawing')) return false;
    // Has smart tag?
    if (xml.includes('<w:smartTag')) return false;
    // Has field?
    if (xml.includes('<w:fldChar') || xml.includes('<w:instrText')) return false;
    return true;
  }

  private _findRelIds(xml: string): string[] {
    const ids = new Set<string>();
    const patterns = [
      /r:id="([^"]*)"/g,
      /r:embed="([^"]*)"/g,
      /r:link="([^"]*)"/g,
      /r:href="([^"]*)"/g,
    ];
    for (const pattern of patterns) {
      const re = new RegExp(pattern.source, pattern.flags);
      let m: RegExpExecArray | null;
      while ((m = re.exec(xml)) !== null) ids.add(m[1]);
    }
    return Array.from(ids);
  }

  private _findStyleIds(xml: string): string[] {
    const ids = new Set<string>();
    const re = /w:(?:pStyle|rStyle|tblStyle)\s+w:val="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) ids.add(m[1]);
    return Array.from(ids);
  }

  private _findNumIds(xml: string): string[] {
    const ids = new Set<string>();
    const re = /<w:numId\s+w:val="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) ids.add(m[1]);
    return Array.from(ids);
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  private _extractStyles(stylesXml: string): {
    rawStyles: string[];
    definedStyleIds: Map<string, string>;
  } {
    const rawStyles: string[] = [];
    const definedStyleIds = new Map<string, string>();

    // Use regex to find all <w:style> blocks — they don't self-close
    const styleRe = /<w:style\b[^>]*>[\s\S]*?<\/w:style>/g;
    let m: RegExpExecArray | null;
    while ((m = styleRe.exec(stylesXml)) !== null) {
      const raw = m[0];
      const idMatch = raw.match(/w:styleId="([^"]*)"/);
      if (idMatch) {
        definedStyleIds.set(idMatch[1], raw);
        rawStyles.push(raw);
      }
    }

    return { rawStyles, definedStyleIds };
  }

  /**
   * Extract the <w:docDefaults>...</w:docDefaults> block from a styles.xml string.
   * This block defines the document's default font, paragraph spacing, and line spacing.
   * The source document's docDefaults are used instead of the template's (Fix 2).
   */
  private _extractDocDefaults(stylesXml: string): string | null {
    const m = /<w:docDefaults\b[^>]*>[\s\S]*?<\/w:docDefaults>/.exec(stylesXml);
    return m ? m[0] : null;
  }

  // ─── Numbering ────────────────────────────────────────────────────────────

  private _extractNumbering(numberingXml: string | null): {
    rawAbstractNums: string[];
    rawNums: string[];
    numAbstractMap: Map<number, number>;
  } {
    const rawAbstractNums: string[] = [];
    const rawNums: string[] = [];
    const numAbstractMap = new Map<number, number>();

    if (!numberingXml) return { rawAbstractNums, rawNums, numAbstractMap };

    const abstractRe = /<w:abstractNum\b[^>]*>[\s\S]*?<\/w:abstractNum>/g;
    let m: RegExpExecArray | null;
    while ((m = abstractRe.exec(numberingXml)) !== null) {
      rawAbstractNums.push(m[0]);
    }

    const numRe = /<w:num\b[^>]*>[\s\S]*?<\/w:num>/g;
    while ((m = numRe.exec(numberingXml)) !== null) {
      const raw = m[0];
      rawNums.push(raw);
      const numIdMatch = raw.match(/w:numId="([^"]*)"/);
      const absIdMatch = raw.match(/<w:abstractNumId[^>]*w:val="([^"]*)"/);
      if (numIdMatch && absIdMatch) {
        numAbstractMap.set(parseInt(numIdMatch[1], 10), parseInt(absIdMatch[1], 10));
      }
    }

    return { rawAbstractNums, rawNums, numAbstractMap };
  }

  // ─── Footnotes / Endnotes / Comments ─────────────────────────────────────

  private _extractAnnotations(xml: string | null, tagName: string): Map<string, string> {
    const map = new Map<string, string>();
    if (!xml) return map;

    const re = new RegExp(`<w:${tagName}\\b[^>]*>[\\s\\S]*?<\\/w:${tagName}>`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(xml)) !== null) {
      const raw = m[0];
      const idMatch = raw.match(/w:id="([^"]*)"/);
      if (idMatch) {
        const id = idMatch[1];
        // Skip built-in separator annotations (id -1 and 0)
        if (id !== '-1' && id !== '0') {
          map.set(id, raw);
        }
      }
    }
    return map;
  }

  // ─── Bookmarks ────────────────────────────────────────────────────────────

  private _extractBookmarks(documentXml: string): Map<string, string> {
    const bookmarks = new Map<string, string>();
    const re = /<w:bookmarkStart\b[^>]*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(documentXml)) !== null) {
      const raw = m[0];
      const idMatch = raw.match(/w:id="([^"]*)"/);
      const nameMatch = raw.match(/w:name="([^"]*)"/);
      if (idMatch && nameMatch) {
        bookmarks.set(idMatch[1], nameMatch[1]);
      }
    }
    return bookmarks;
  }
}
