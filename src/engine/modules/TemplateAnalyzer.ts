import {
  DocxArchive, PipelineContext, PipelineModule, TemplateModel,
  SectionLayout, StyleDefinition, PageDimensions, PageMargins, RelEntry,
  TemplatePatternModel,
} from '../types';
import { NS, PARTS, REL_TYPES } from '../utils/ooxml';
import { ArchiveParser } from './ArchiveParser';

// ─── Template Analyzer ────────────────────────────────────────────────────────
// Stage 2: Reads the template archive and produces a TemplateModel.
// NEVER modifies any XML. Pure analysis only.

export class TemplateAnalyzer implements PipelineModule {
  readonly name = 'TemplateAnalyzer';

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    ctx.onProgress('Analyzing template', 10);
    ctx.templateModel = this.analyze(ctx.templateArchive!, ctx.templateFile?.name);
    ctx.onProgress('Template analyzed', 20);
    return ctx;
  }

  analyze(arc: DocxArchive, templateFileName: string = ''): TemplateModel {
    const documentXmlRaw = arc.rawXmlParts.get(PARTS.document) ?? '';
    const stylesXmlRaw = arc.rawXmlParts.get(PARTS.styles) ?? '';
    const settingsXmlRaw = arc.rawXmlParts.get(PARTS.settings) ?? null;
    const numberingXmlRaw = arc.rawXmlParts.get(PARTS.numbering) ?? null;
    const fontTableXmlRaw = arc.rawXmlParts.get(PARTS.fontTable) ?? null;
    const webSettingsXmlRaw = arc.rawXmlParts.get(PARTS.webSettings) ?? null;

    const documentRels = ArchiveParser.getRels(arc, PARTS.document);

    // Parse namespace declarations from document root
    const documentRootNamespaces = this._extractRootNamespaces(documentXmlRaw);

    // Compute maxRelIdNumber from template rels
    const maxRelIdNumber = this._computeMaxRelId(documentRels);

    // Extract header/footer parts
    const headerFooterParts = new Map<string, string>();
    for (const rel of documentRels) {
      if (rel.type === REL_TYPES.header || rel.type === REL_TYPES.footer) {
        const partPath = ArchiveParser.resolveTarget(PARTS.document, rel.target);
        const raw = arc.rawXmlParts.get(partPath);
        if (raw) headerFooterParts.set(partPath, raw);
      }
    }

    // Extract theme paths
    const themePartPaths: string[] = [];
    for (const rel of documentRels) {
      if (rel.type === REL_TYPES.theme) {
        themePartPaths.push(ArchiveParser.resolveTarget(PARTS.document, rel.target));
      }
    }

    // Extract defined style IDs from styles.xml
    const definedStyleIds = this._extractDefinedStyleIds(stylesXmlRaw);

    // Extract numbering IDs
    const { definedNumIds, definedAbstractNumIds } = this._extractNumberingIds(numberingXmlRaw);

    // Extract sections, documentSectPrXml and multi-page patternModel from document.xml
    const { sections, documentSectPrXml, patternModel } = this._extractSections(
      documentXmlRaw,
      settingsXmlRaw,
      headerFooterParts,
      templateFileName
    );

    // Check titlePg and evenAndOddHeaders in settings
    const titlePg = documentSectPrXml.includes('<w:titlePg');
    const evenAndOddHeaders = (settingsXmlRaw ?? '').includes('<w:evenAndOddHeaders');

    // Collect all media paths from the template archive.
    // MergePlanner uses this to prevent data doc media from overwriting template assets.
    const templateMediaPaths = new Set<string>(arc.mediaParts.keys());

    return {
      documentXmlRaw,
      stylesXmlRaw,
      settingsXmlRaw,
      numberingXmlRaw,
      fontTableXmlRaw,
      webSettingsXmlRaw,
      headerFooterParts,
      themePartPaths,
      definedStyleIds,
      definedNumIds,
      definedAbstractNumIds,
      documentRels,
      maxRelIdNumber,
      documentRootNamespaces,
      sections,
      documentSectPrXml,
      titlePg,
      evenAndOddHeaders,
      templateMediaPaths,
      patternModel,
    };
  }

  // ─── Root namespace extraction ────────────────────────────────────────────

  private _extractRootNamespaces(xml: string): Record<string, string> {
    const ns: Record<string, string> = {};
    // Match the opening element tag (up to the first >)
    const rootTagMatch = xml.match(/<[a-zA-Z:][^>]*/);
    if (!rootTagMatch) return ns;
    const rootTag = rootTagMatch[0];
    // Extract all xmlns:prefix="uri" and xmlns="uri" declarations
    const nsRegex = /xmlns(?::([a-zA-Z0-9_-]+))?="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = nsRegex.exec(rootTag)) !== null) {
      const prefix = m[1] ?? '';
      const uri = m[2];
      ns[prefix] = uri;
    }
    return ns;
  }

  private _computeMaxRelId(rels: RelEntry[]): number {
    let max = 0;
    for (const rel of rels) {
      const m = rel.id.match(/\d+$/);
      if (m) max = Math.max(max, parseInt(m[0], 10));
    }
    return max;
  }

  // ─── Style IDs ────────────────────────────────────────────────────────────

  private _extractDefinedStyleIds(stylesXml: string): Set<string> {
    const ids = new Set<string>();
    const re = /w:styleId="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(stylesXml)) !== null) {
      ids.add(m[1]);
    }
    return ids;
  }

  // ─── Numbering IDs ────────────────────────────────────────────────────────

  private _extractNumberingIds(numberingXml: string | null): {
    definedNumIds: Set<string>;
    definedAbstractNumIds: Set<string>;
  } {
    const definedNumIds = new Set<string>();
    const definedAbstractNumIds = new Set<string>();
    if (!numberingXml) return { definedNumIds, definedAbstractNumIds };

    const numIdRe = /<w:num\s[^>]*w:numId="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = numIdRe.exec(numberingXml)) !== null) definedNumIds.add(m[1]);

    const abstractRe = /<w:abstractNum\s[^>]*w:abstractNumId="([^"]*)"/g;
    while ((m = abstractRe.exec(numberingXml)) !== null) definedAbstractNumIds.add(m[1]);

    return { definedNumIds, definedAbstractNumIds };
  }

  // ─── Section / sectPr extraction ─────────────────────────────────────────

  private _extractSections(
    docXml: string,
    settingsXml: string | null = null,
    headerFooterParts: Map<string, string> = new Map(),
    templateFileName: string = ''
  ): {
    sections: SectionLayout[];
    documentSectPrXml: string;
    patternModel: TemplatePatternModel;
  } {
    const rawLayouts: string[] = [];

    // Extract all <w:sectPr> blocks in document XML order
    const sectPrRegex = /<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>/g;
    let m: RegExpExecArray | null;
    while ((m = sectPrRegex.exec(docXml)) !== null) {
      rawLayouts.push(m[0]);
    }

    let documentSectPrXml = rawLayouts.length > 0
      ? rawLayouts[rawLayouts.length - 1]
      : '<w:sectPr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>';

    const hasEvenOddSetting = (settingsXml ?? '').includes('<w:evenAndOddHeaders');
    const isExplicitTwoSided = /two[-_]?sided|2[-_]?sided/i.test(templateFileName);
    const isExplicitOneSided = /one[-_]?sided|1[-_]?sided/i.test(templateFileName);

    // One-Sided mode: repeat the template header area on EVERY page.
    // If settings has evenAndOddHeaders (e.g. from alternating footers) but sectPr lacks an even header,
    // explicitly map w:type="even" to the same header rId so Microsoft Word renders the header on both odd and even pages.
    if (isExplicitOneSided || !isExplicitTwoSided) {
      const hasEvenHeader = /<w:headerReference[^>]*w:type="even"|<w:headerReference[^>]*r:id="[^"]*"[^>]*w:type="even"/.test(documentSectPrXml);
      if (hasEvenOddSetting && !hasEvenHeader) {
        const fullDefaultTagMatch = /<w:headerReference\b[^>]*w:type="default"[^>]*\/>/.exec(documentSectPrXml) ||
                                    /<w:headerReference\b[^>]*\/>/.exec(documentSectPrXml);
        if (fullDefaultTagMatch) {
          const rIdMatch = /r:id="([^"]*)"/.exec(fullDefaultTagMatch[0]);
          if (rIdMatch) {
            const headerId = rIdMatch[1];
            documentSectPrXml = documentSectPrXml.replace(
              fullDefaultTagMatch[0],
              `${fullDefaultTagMatch[0]}<w:headerReference w:type="even" r:id="${headerId}"/>`
            );
          }
        }
      }
      return {
        sections: [],
        documentSectPrXml,
        patternModel: {
          layouts: [documentSectPrXml],
          length: 1,
        },
      };
    }

    // Two-Sided mode: preserve exact front/back behavior of reference template
    const hasEvenHeaderInDoc = docXml.includes('w:type="even"');
    const hasEvenPart = Array.from(headerFooterParts.keys()).some(p => p.toLowerCase().includes('even'));
    const isTwoSidedSingleSection = rawLayouts.length === 1 && (hasEvenOddSetting || hasEvenHeaderInDoc || hasEvenPart);

    let patternLayouts: string[] = [];

    if (rawLayouts.length >= 2) {
      patternLayouts = rawLayouts;
    } else if (isTwoSidedSingleSection) {
      const baseSectPr = rawLayouts[0] || documentSectPrXml;
      const { front, back } = this._buildFrontBackLayouts(baseSectPr);
      patternLayouts = [front, back];
    } else {
      patternLayouts = rawLayouts.length > 0 ? rawLayouts : [documentSectPrXml];
    }

    const patternModel: TemplatePatternModel = {
      layouts: patternLayouts,
      length: patternLayouts.length,
    };

    return { sections: [], documentSectPrXml, patternModel };
  }

  private _buildFrontBackLayouts(sectPr: string): { front: string; back: string } {
    const front = sectPr;
    let back = sectPr;

    const evenHeaderMatch = /<w:headerReference[^>]*w:type="even"[^>]*r:id="([^"]*)"/.exec(sectPr) ||
                            /<w:headerReference[^>]*r:id="([^"]*)"[^>]*w:type="even"/.exec(sectPr);
    const evenFooterMatch = /<w:footerReference[^>]*w:type="even"[^>]*r:id="([^"]*)"/.exec(sectPr) ||
                            /<w:footerReference[^>]*r:id="([^"]*)"[^>]*w:type="even"/.exec(sectPr);

    if (evenHeaderMatch) {
      const evenId = evenHeaderMatch[1];
      back = back.replace(
        /(<w:headerReference[^>]*w:type="default"[^>]*r:id=")[^"]*"/g,
        `$1${evenId}"`
      ).replace(
        /(<w:headerReference[^>]*r:id=")[^"]*("[^>]*w:type="default")/g,
        `$1${evenId}$2`
      );
    }
    if (evenFooterMatch) {
      const evenId = evenFooterMatch[1];
      back = back.replace(
        /(<w:footerReference[^>]*w:type="default"[^>]*r:id=")[^"]*"/g,
        `$1${evenId}"`
      ).replace(
        /(<w:footerReference[^>]*r:id=")[^"]*("[^>]*w:type="default")/g,
        `$1${evenId}$2`
      );
    }

    return { front, back };
  }

  private _findLastSectPr(docXml: string): string | null {
    let lastStart = -1;
    let lastEnd = -1;
    let idx = 0;
    while (true) {
      const start = docXml.indexOf('<w:sectPr', idx);
      if (start < 0) break;
      const selfClose = docXml.indexOf('/>', start);
      const closeTag = docXml.indexOf('</w:sectPr>', start);
      let end: number;
      if (selfClose >= 0 && (closeTag < 0 || selfClose < closeTag)) {
        end = selfClose + 2;
      } else if (closeTag >= 0) {
        end = closeTag + '</w:sectPr>'.length;
      } else {
        break;
      }
      lastStart = start;
      lastEnd = end;
      idx = end;
    }
    if (lastStart < 0) return null;
    return docXml.slice(lastStart, lastEnd);
  }
}
