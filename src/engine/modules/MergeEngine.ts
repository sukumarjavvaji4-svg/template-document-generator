import {
  PipelineContext, PipelineModule, DocumentModel, TemplateModel,
  MergePlan, MergeItem, RelEntry, FootnoteAddition,
} from '../types';
import { PARTS, REL_TYPES } from '../utils/ooxml';

// ─── Merge Engine ─────────────────────────────────────────────────────────────
// Stage 7: THE ONLY STAGE THAT MODIFIES XML.
//
// Strategy: Work entirely with raw XML STRINGS.
// - Take the template document.xml string as the base
// - Find the body injection point (before the document-level sectPr)
// - Apply all planned substitutions to each data content string
// - Inject the data content at the injection point
// - Build styles.xml, numbering.xml etc. by appending to template XML strings
//
// CRITICAL: We never re-serialize DOM nodes across document contexts.
// All operations are string-level, which preserves namespace prefix bindings.

export class MergeEngine implements PipelineModule {
  readonly name = 'MergeEngine';

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    ctx.onProgress('Merging documents', 55);
    ctx.documentModel = this.merge(
      ctx.templateModel!,
      ctx.mergePlan!,
    );
    ctx.onProgress('Merge complete', 75);
    return ctx;
  }

  merge(templateModel: TemplateModel, plan: MergePlan): DocumentModel {
    // ── 1. Build document.xml ─────────────────────────────────────────────
    const documentXml = this._buildDocumentXml(templateModel, plan);

    // ── 2. Build styles.xml ───────────────────────────────────────────────
    const stylesXml = this._buildStylesXml(templateModel.stylesXmlRaw, plan);

    // ── 3. Build numbering.xml ────────────────────────────────────────────
    const numberingXml = this._buildNumberingXml(templateModel.numberingXmlRaw, plan);

    // ── 4. Build document.xml.rels ────────────────────────────────────────
    const documentRels = this._buildDocumentRels(templateModel, plan);

    // ── 5. Build footnotes/endnotes/comments ──────────────────────────────
    const footnotesXml = this._buildFootnotesXml(templateModel, plan);
    const endnotesXml = this._buildEndnotesXml(templateModel, plan);
    const commentsXml = this._buildCommentsXml(templateModel, plan);

    // ── 4. Settings (Preserve template settings verbatim including evenAndOddHeaders) ──
    const settingsXml = templateModel.settingsXmlRaw;



    // ── 6. Collect headers and footers (from template, unchanged) ─────────
    const headers = new Map<string, string>();
    const footers = new Map<string, string>();
    for (const [path, xml] of templateModel.headerFooterParts) {
      if (path.includes('header')) headers.set(path, xml);
      else footers.set(path, xml);
    }

    // ── 7. Collect all media ──────────────────────────────────────────────
    const media = new Map<string, Uint8Array>();
    for (const rel of plan.relAdditions) {
      if (rel.mediaPath && rel.mediaData) {
        media.set(rel.mediaPath, rel.mediaData);
      }
    }

    return {
      documentXml,
      stylesXml,
      numberingXml,
      settingsXml,
      fontTableXml: templateModel.fontTableXmlRaw,
      webSettingsXml: templateModel.webSettingsXmlRaw,
      headers,
      footers,
      footnotesXml,
      endnotesXml,
      commentsXml,
      documentRels,
      media,
      themePartPaths: templateModel.themePartPaths,
    };
  }

  // ─── document.xml builder ─────────────────────────────────────────────────

  private _buildDocumentXml(templateModel: TemplateModel, plan: MergePlan): string {
    const templateXml = templateModel.documentXmlRaw;

    // ── Find the body tag (with or without attributes) ────────────────────
    // Standard OOXML body is <w:body> with no attributes.
    let bodyOpenIdx = templateXml.indexOf('<w:body>');
    let bodyOpenTagLen = '<w:body>'.length;

    if (bodyOpenIdx < 0) {
      // Try with attributes: <w:body ...>
      bodyOpenIdx = templateXml.indexOf('<w:body ');
      if (bodyOpenIdx >= 0) {
        const tagEnd = templateXml.indexOf('>', bodyOpenIdx);
        bodyOpenTagLen = tagEnd < 0 ? 8 : tagEnd - bodyOpenIdx + 1;
      }
    }

    const bodyCloseTag = '</w:body>';
    const bodyCloseIdx = templateXml.lastIndexOf(bodyCloseTag);

    if (bodyOpenIdx < 0 || bodyCloseIdx < 0) {
      return this._buildFallbackDocument(templateModel, plan);
    }

    const afterBodyOpen = bodyOpenIdx + bodyOpenTagLen;
    const bodyContent = templateXml.slice(afterBodyOpen, bodyCloseIdx);

    // ── Document-level sectPr anchor ──────────────────────────────────────
    // The final section at the end of <w:body> receives the final layout descriptor
    // computed from the cyclic patternModel sequence.
    const bodySuffix = plan.finalSectPrXml || templateModel.documentSectPrXml;

    // ── Build data content XML ─────────────────────────────────────────────
    const rootNs = templateModel.documentRootNamespaces;
    const dataContentLines: string[] = [];

    for (const item of plan.mergeItems) {
      let xml = item.xmlString;

      // Apply all planned substitutions
      for (const [oldToken, newToken] of item.substitutions) {
        if (oldToken !== newToken) {
          xml = this._replaceAll(xml, oldToken, newToken);
        }
      }

      // Strip namespace declarations already declared in template root
      xml = this._stripRedundantNamespaces(xml, rootNs);

      dataContentLines.push(xml);
    }

    const dataContent = dataContentLines.join('\n');

    // ── Assemble final document.xml ────────────────────────────────────────
    // Structure: [before body] + <w:body> + [data content] + [finalSectPr] + </w:body> + [after body]
    const beforeBody = templateXml.slice(0, afterBodyOpen);
    const afterBody = templateXml.slice(bodyCloseIdx);

    const finalDocXml = beforeBody
      + '\n'
      + dataContent
      + '\n'
      + bodySuffix
      + '\n'
      + afterBody;

    return this._ensureXmlDecl(finalDocXml);
  }

  private _findLastSectPrStart(bodyContent: string): number | null {
    // Find the last top-level <w:sectPr or a paragraph that ONLY contains sectPr
    // We look for the last occurrence of <w:sectPr
    const lastIdx = bodyContent.lastIndexOf('<w:sectPr');
    if (lastIdx < 0) return null;
    // Find where the containing paragraph starts (if it's inside a <w:p>)
    // Look backwards from lastIdx for <w:p
    const precedingContent = bodyContent.slice(0, lastIdx);
    const lastParaStart = precedingContent.lastIndexOf('<w:p>');
    const lastParaStartAttr = precedingContent.lastIndexOf('<w:p ');
    const paraStart = Math.max(lastParaStart, lastParaStartAttr);

    if (paraStart >= 0) {
      // Check if this paragraph ONLY contains pPr/sectPr (no actual content)
      const paraContent = bodyContent.slice(paraStart);
      const firstClose = paraContent.indexOf('</w:p>');
      if (firstClose >= 0) {
        const paraXml = paraContent.slice(0, firstClose + '</w:p>'.length);
        // Does this paragraph have any <w:r> or <w:ins> or <w:hyperlink>?
        if (!paraXml.includes('<w:r>') && !paraXml.includes('<w:r ') &&
            !paraXml.includes('<w:ins') && !paraXml.includes('<w:hyperlink')) {
          return paraStart;
        }
      }
    }

    return lastIdx;
  }

  private _buildFallbackDocument(templateModel: TemplateModel, plan: MergePlan): string {
    const ns = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    const dataContent = plan.mergeItems.map(item => {
      let xml = item.xmlString;
      for (const [o, n] of item.substitutions) xml = this._replaceAll(xml, o, n);
      return xml;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${ns}>
<w:body>
${dataContent}
${templateModel.documentSectPrXml}
</w:body>
</w:document>`;
  }

  // ─── styles.xml builder ───────────────────────────────────────────────────

  private _buildStylesXml(templateStylesXml: string, plan: MergePlan): string {
    let base = templateStylesXml;

    // FIX 2: Replace template's <w:docDefaults> with the source document's.
    //
    // OWNERSHIP POLICY:
    //   Template owns: page layout, borders, headers, footers, page settings.
    //   Source doc owns: body typography, default font, paragraph spacing, line spacing.
    //
    // The template's <w:docDefaults> controls default font and paragraph spacing
    // which overrides the source document's spacing (e.g. larger paragraph spacing,
    // different line spacing, different font). We replace it with the source doc's
    // docDefaults to preserve the source document typography.
    if (plan.contentDocDefaultsXml) {
      base = this._replaceDocDefaults(base, plan.contentDocDefaultsXml);
    }

    // Append new styles from data documents before </w:styles>
    if (plan.styleAdditions.length === 0) {
      return this._ensureXmlDecl(base);
    }

    const closeTag = '</w:styles>';
    const closeIdx = base.lastIndexOf(closeTag);
    if (closeIdx < 0) {
      return this._ensureXmlDecl(base);
    }

    const newStylesXml = plan.styleAdditions.map(s => s.xmlString).join('\n');
    return this._ensureXmlDecl(
      base.slice(0, closeIdx)
      + '\n'
      + newStylesXml
      + '\n'
      + closeTag
    );
  }

  /**
   * Replace the <w:docDefaults> block in a styles.xml string.
   * Used to swap the template's default typography with the source document's.
   */
  private _replaceDocDefaults(stylesXml: string, newDocDefaults: string): string {
    const existing = /<w:docDefaults\b[^>]*>[\s\S]*?<\/w:docDefaults>/.exec(stylesXml);
    if (!existing) {
      // No existing docDefaults — insert before the first <w:style>
      const firstStyle = stylesXml.indexOf('<w:style');
      if (firstStyle < 0) return stylesXml;
      return (
        stylesXml.slice(0, firstStyle)
        + newDocDefaults + '\n'
        + stylesXml.slice(firstStyle)
      );
    }
    return (
      stylesXml.slice(0, existing.index)
      + newDocDefaults
      + stylesXml.slice(existing.index + existing[0].length)
    );
  }

  // ─── numbering.xml builder ────────────────────────────────────────────────

  private _buildNumberingXml(
    templateNumberingXml: string | null,
    plan: MergePlan
  ): string | null {
    const hasNewItems = plan.numberingAdditions.length > 0;
    const hasTemplate = templateNumberingXml !== null;

    if (!hasNewItems && !hasTemplate) return null;

    // FIX 3 (MergeEngine side): Deduplicate abstractNums by newAbstractId.
    // MergePlanner sets abstractNumXml='' for duplicate entries; here we filter
    // them out and deduplicate by ID as a safety net so numbering.xml never has
    // two <w:abstractNum> elements with the same w:abstractNumId.
    const seenAbstractIds = new Set<number>();
    const abstractNums: string[] = [];
    const concreteNums: string[] = [];

    for (const addition of plan.numberingAdditions) {
      if (addition.abstractNumXml && !seenAbstractIds.has(addition.newAbstractId)) {
        abstractNums.push(addition.abstractNumXml);
        seenAbstractIds.add(addition.newAbstractId);
      }
      if (addition.numXml) {
        concreteNums.push(addition.numXml);
      }
    }

    if (hasTemplate) {
      let tmplXml = templateNumberingXml!;

      // OOXML Schema Enforcement: ALL <w:abstractNum> elements MUST precede ALL <w:num> elements.
      // Find the insertion point for new <w:abstractNum> entries (before the first <w:num>).
      if (abstractNums.length > 0) {
        let firstNumIdx = tmplXml.indexOf('<w:num>');
        if (firstNumIdx < 0) firstNumIdx = tmplXml.indexOf('<w:num ');
        if (firstNumIdx >= 0) {
          tmplXml = tmplXml.slice(0, firstNumIdx) + abstractNums.join('\n') + '\n' + tmplXml.slice(firstNumIdx);
        } else {
          const closeIdx = tmplXml.lastIndexOf('</w:numbering>');
          if (closeIdx >= 0) {
            tmplXml = tmplXml.slice(0, closeIdx) + abstractNums.join('\n') + '\n' + tmplXml.slice(closeIdx);
          }
        }
      }

      // Insert new <w:num> entries before </w:numbering>
      if (concreteNums.length > 0) {
        const closeIdx = tmplXml.lastIndexOf('</w:numbering>');
        if (closeIdx >= 0) {
          tmplXml = tmplXml.slice(0, closeIdx) + concreteNums.join('\n') + '\n' + tmplXml.slice(closeIdx);
        }
      }

      return this._ensureXmlDecl(tmplXml);
    }

    // Build from scratch (no template numbering.xml)
    return this._ensureXmlDecl(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${abstractNums.join('\n')}
${concreteNums.join('\n')}
</w:numbering>`

    );
  }

  // ─── document.xml.rels builder ────────────────────────────────────────────

  private _buildDocumentRels(templateModel: TemplateModel, plan: MergePlan): RelEntry[] {
    // Start with ALL template rels EXACTLY as they are (no ID reassignment)
    const rels: RelEntry[] = [...templateModel.documentRels];

    // Add new rels from data documents
    for (const addition of plan.relAdditions) {
      rels.push({
        id: addition.newId,
        type: addition.type,
        target: addition.target,
        targetMode: addition.targetMode,
      });
    }

    return rels;
  }

  // ─── Footnotes/Endnotes/Comments builders ────────────────────────────────

  private _buildFootnotesXml(templateModel: TemplateModel, plan: MergePlan): string | null {
    if (!plan.needsFootnotesPart) return null;

    const existingXml = templateModel.settingsXmlRaw; // not footnotes — just for reference
    // Build minimal footnotes container with required separators
    const entries = plan.footnoteAdditions.map(f => f.xmlString).join('\n');
    return this._ensureXmlDecl(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>
<w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>
${entries}
</w:footnotes>`);
  }

  private _buildEndnotesXml(templateModel: TemplateModel, plan: MergePlan): string | null {
    if (!plan.needsEndnotesPart) return null;
    const entries = plan.endnoteAdditions.map(e => e.xmlString).join('\n');
    return this._ensureXmlDecl(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:endnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:endnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:endnote>
<w:endnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:endnote>
${entries}
</w:endnotes>`);
  }

  private _buildCommentsXml(templateModel: TemplateModel, plan: MergePlan): string | null {
    if (!plan.needsCommentsPart) return null;
    const entries = plan.commentAdditions.map(c => c.xmlString).join('\n');
    return this._ensureXmlDecl(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${entries}
</w:comments>`);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Strip namespace declarations from an XML string that are already declared
   * in the template document root. This removes redundant xmlns:w="..." etc.
   * from serialized element strings before injecting them into the template.
   */
  private _stripRedundantNamespaces(
    xml: string,
    rootNs: Record<string, string>
  ): string {
    let result = xml;
    for (const [prefix, uri] of Object.entries(rootNs)) {
      const decl = prefix
        ? `xmlns:${prefix}="${uri}"`
        : `xmlns="${uri}"`;
      // Remove this declaration from the string
      result = result.split(decl).join('');
    }
    // Clean up any double spaces left by removal
    result = result.replace(/  +/g, ' ').replace(/ >/g, '>').replace(/ \/>/g, '/>');
    return result;
  }

  private _replaceAll(str: string, search: string, replace: string): string {
    if (!search || search === replace) return str;
    return str.split(search).join(replace);
  }

  private _ensureXmlDecl(xml: string): string {
    const trimmed = xml.trimStart();
    if (trimmed.startsWith('<?xml')) return xml;
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' + xml;
  }
}
