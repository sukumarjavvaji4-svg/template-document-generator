import {
  PipelineContext, PipelineModule, DocumentModel, ValidationReport,
  ValidationEntry, ValidationCheckResult, RelEntry,
} from '../types';
import { PARTS, CONTENT_TYPES } from '../utils/ooxml';

// ─── OOXML Validator ──────────────────────────────────────────────────────────
// Stage 8: Validates the DocumentModel before export.
// Never modifies any XML. Pure validation.
// Produces a structured ValidationReport.

export class OOXMLValidator implements PipelineModule {
  readonly name = 'OOXMLValidator';

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    ctx.onProgress('Validating package', 77);
    ctx.validationReport = this.validate(ctx.documentModel!);
    ctx.onProgress('Validation complete', 85);
    return ctx;
  }

  validate(model: DocumentModel): ValidationReport {
    const checks: ValidationCheckResult[] = [
      this._checkXmlSyntax(model),
      this._checkRelationships(model),
      this._checkStyleRefs(model),
      this._checkNumberingRefs(model),
      this._checkHeaderFooterRefs(model),
      this._checkMediaRefs(model),
      this._checkRequiredParts(model),
    ];

    const allEntries: ValidationEntry[] = checks.flatMap(c => c.entries);
    const errorCount = allEntries.filter(e => e.severity === 'error').length;
    const warningCount = allEntries.filter(e => e.severity === 'warning').length;
    const repairedCount = allEntries.filter(e => e.severity === 'repaired').length;

    const valid = errorCount === 0;

    return { valid, checks, entries: allEntries, errorCount, warningCount, repairedCount };
  }

  // ─── Check 1: XML Syntax ──────────────────────────────────────────────────

  private _checkXmlSyntax(model: DocumentModel): ValidationCheckResult {
    const entries: ValidationEntry[] = [];
    const parts: Array<[string, string | null]> = [
      [PARTS.document, model.documentXml],
      [PARTS.styles, model.stylesXml],
      [PARTS.numbering, model.numberingXml],
      [PARTS.settings, model.settingsXml],
      [PARTS.footnotes, model.footnotesXml],
      [PARTS.endnotes, model.endnotesXml],
      [PARTS.comments, model.commentsXml],
    ];
    for (const [path, xml] of model.headers) parts.push([path, xml]);
    for (const [path, xml] of model.footers) parts.push([path, xml]);

    for (const [path, xml] of parts) {
      if (!xml) continue;
      const result = this._tryParseXml(xml);
      if (!result.ok) {
        entries.push({
          code: 'XML_PARSE_ERROR',
          message: `XML parse error in ${path}: ${result.error}`,
          severity: 'error',
          location: path,
        });
      }
    }

    return { name: 'XML Syntax', passed: entries.filter(e => e.severity === 'error').length === 0, entries };
  }

  // ─── Check 2: Relationships ───────────────────────────────────────────────

  private _checkRelationships(model: DocumentModel): ValidationCheckResult {
    const entries: ValidationEntry[] = [];
    const relIds = new Set<string>();
    const duplicates = new Set<string>();

    const seenTargets = new Set<string>();
    for (const rel of model.documentRels) {
      if (relIds.has(rel.id)) {
        duplicates.add(rel.id);
        entries.push({
          code: 'DUPLICATE_REL_ID',
          message: `Duplicate relationship ID: ${rel.id}`,
          severity: 'error',
          location: PARTS.documentRels,
        });
      }
      relIds.add(rel.id);

      if (rel.targetMode !== 'External') {
        const cleanT = rel.target.toLowerCase();
        if (cleanT.endsWith('numbering.xml') || cleanT.endsWith('styles.xml') || cleanT.endsWith('settings.xml')) {
          if (seenTargets.has(cleanT)) {
            entries.push({
              code: 'FATAL_DUPLICATE_REL_TARGET',
              message: `Duplicate relationship target "${rel.target}" in document.xml.rels. Microsoft Word will mark document as corrupt.`,
              severity: 'error',
              location: PARTS.documentRels,
            });
          }
          seenTargets.add(cleanT);
        }
      }

      // Check target exists (for internal rels pointing to media)
      if (rel.targetMode !== 'External' && rel.target.startsWith('media/')) {
        const fullPath = `word/${rel.target}`;
        if (!model.media.has(fullPath)) {
          entries.push({
            code: 'MISSING_MEDIA_TARGET',
            message: `Relationship ${rel.id} points to missing media file: ${rel.target}`,
            severity: 'error',
            location: PARTS.documentRels,
          });
        }
      }

      // Check required fields
      if (!rel.id || !rel.type || !rel.target) {
        entries.push({
          code: 'INVALID_REL_ENTRY',
          message: `Relationship entry missing required field: id=${rel.id}, type=${rel.type}, target=${rel.target}`,
          severity: 'error',
          location: PARTS.documentRels,
        });
      }
    }

    return { name: 'Relationships', passed: entries.filter(e => e.severity === 'error').length === 0, entries };
  }

  // ─── Check 3: Style references ────────────────────────────────────────────

  private _checkStyleRefs(model: DocumentModel): ValidationCheckResult {
    const entries: ValidationEntry[] = [];

    // Extract all defined style IDs from styles.xml
    const definedStyleIds = new Set<string>();
    const styleIdRe = /w:styleId="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = styleIdRe.exec(model.stylesXml)) !== null) {
      definedStyleIds.add(m[1]);
    }

    // Find all style references in document.xml
    const styleRefRe = /w:(?:pStyle|rStyle|tblStyle)\s+w:val="([^"]*)"/g;
    while ((m = styleRefRe.exec(model.documentXml)) !== null) {
      const ref = m[1];
      if (!definedStyleIds.has(ref)) {
        entries.push({
          code: 'UNDEFINED_STYLE_REF',
          message: `Document references undefined style: "${ref}"`,
          severity: 'warning',
          location: PARTS.document,
        });
      }
    }

    return { name: 'Style References', passed: true, entries };
  }

  // ─── Check 4: Numbering references ──────────────────────────────────────────────

  private _checkNumberingRefs(model: DocumentModel): ValidationCheckResult {
    const entries: ValidationEntry[] = [];
    if (!model.numberingXml) return { name: 'Numbering', passed: true, entries };

    // Collect all defined abstractNumId values — detect duplicates
    const definedAbstractIds = new Map<string, number>(); // id → count
    const abstractIdRe = /<w:abstractNum\s[^>]*w:abstractNumId="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = abstractIdRe.exec(model.numberingXml)) !== null) {
      const id = m[1];
      definedAbstractIds.set(id, (definedAbstractIds.get(id) ?? 0) + 1);
    }
    for (const [id, count] of definedAbstractIds) {
      if (count > 1) {
        entries.push({
          code: 'DUPLICATE_ABSTRACT_NUM',
          message: `numbering.xml has ${count} <w:abstractNum> elements with w:abstractNumId="${id}". Word will reject this.`,
          severity: 'error',
          location: PARTS.numbering,
        });
      }
    }

    // Collect all defined numId values
    const definedNumIds = new Set<string>();
    const numIdRe = /<w:num\s[^>]*w:numId="([^"]*)"/g;
    while ((m = numIdRe.exec(model.numberingXml)) !== null) {
      definedNumIds.add(m[1]);
    }

    // Verify every <w:abstractNumId w:val> in <w:num> elements references a known abstractNum
    const absRefRe = /<w:abstractNumId[^>]*w:val="([^"]*)"/g;
    while ((m = absRefRe.exec(model.numberingXml)) !== null) {
      if (!definedAbstractIds.has(m[1])) {
        entries.push({
          code: 'ORPHAN_NUM_ABSTRACT_REF',
          message: `<w:num> references abstractNumId="${m[1]}" which is not defined`,
          severity: 'error',
          location: PARTS.numbering,
        });
      }
    }

    // Verify every <w:numId> in document.xml references a defined numId (skip val="0" = no list)
    const refRe = /<w:numId\s+w:val="([^"]*)"/g;
    while ((m = refRe.exec(model.documentXml)) !== null) {
      const ref = m[1];
      if (ref !== '0' && !definedNumIds.has(ref)) {
        entries.push({
          code: 'UNDEFINED_NUM_REF',
          message: `Document references undefined numId: ${ref}`,
          severity: 'error',
          location: PARTS.document,
        });
      }
    }

    const hasErrors = entries.some(e => e.severity === 'error');
    return { name: 'Numbering', passed: !hasErrors, entries };
  }

  // ─── Check 5: Header/Footer references ──────────────────────────────────────────────

  private _checkHeaderFooterRefs(model: DocumentModel): ValidationCheckResult {
    const entries: ValidationEntry[] = [];

    const hfRefRe = /<w:(?:header|footer)Reference[^>]*r:id="([^"]*)"/g;
    let m: RegExpExecArray | null;
    const relIdToTarget = new Map(model.documentRels.map(r => [r.id, r.target]));
    const checkedIds = new Set<string>();

    while ((m = hfRefRe.exec(model.documentXml)) !== null) {
      const refId = m[1];
      if (checkedIds.has(refId)) continue;
      checkedIds.add(refId);

      const target = relIdToTarget.get(refId);
      if (!target) {
        entries.push({
          code: 'MISSING_HF_REL',
          message: `Header/footer reference "${refId}" has no relationship entry`,
          severity: 'error',
          location: PARTS.document,
        });
        continue;
      }
      const partPath = `word/${target}`;
      const hasXml = model.headers.has(partPath) || model.footers.has(partPath);
      if (!hasXml) {
        entries.push({
          code: 'MISSING_HF_PART',
          message: `Header/footer rel "${refId}" → "${target}" has no corresponding XML part`,
          severity: 'error',
          location: PARTS.document,
        });
      }
    }

    const hasErrors = entries.some(e => e.severity === 'error');
    return { name: 'Header/Footer References', passed: !hasErrors, entries };
  }

  // ─── Check 6: Media references ────────────────────────────────────────────

  private _checkMediaRefs(model: DocumentModel): ValidationCheckResult {
    const entries: ValidationEntry[] = [];

    // Find all r:embed and r:id in document.xml that reference images
    const embedRe = /r:embed="([^"]*)"/g;
    let m: RegExpExecArray | null;
    const relIdToTarget = new Map(model.documentRels.map(r => [r.id, r.target]));

    while ((m = embedRe.exec(model.documentXml)) !== null) {
      const relId = m[1];
      const target = relIdToTarget.get(relId);
      if (!target) {
        entries.push({
          code: 'DANGLING_IMAGE_REF',
          message: `Image embed "${relId}" has no relationship entry`,
          severity: 'error',
          location: PARTS.document,
        });
        continue;
      }
      const fullPath = `word/${target}`;
      if (!model.media.has(fullPath)) {
        entries.push({
          code: 'MISSING_IMAGE_FILE',
          message: `Image "${relId}" → "${target}" not found in media`,
          severity: 'error',
          location: PARTS.document,
        });
      }
    }

    const hasErrors = entries.some(e => e.severity === 'error');
    return { name: 'Media References', passed: !hasErrors, entries };
  }

  // ─── Check 7: Required parts ──────────────────────────────────────────────

  private _checkRequiredParts(model: DocumentModel): ValidationCheckResult {
    const entries: ValidationEntry[] = [];

    if (!model.documentXml || model.documentXml.length < 50) {
      entries.push({ code: 'MISSING_DOCUMENT_XML', message: 'document.xml is empty or missing', severity: 'error', location: PARTS.document });
    }
    if (!model.stylesXml || model.stylesXml.length < 50) {
      entries.push({ code: 'MISSING_STYLES_XML', message: 'styles.xml is empty or missing', severity: 'warning', location: PARTS.styles });
    }

    const hasBody = model.documentXml.includes('<w:body>') || model.documentXml.includes('<w:body ');
    if (!hasBody) {
      entries.push({ code: 'MISSING_BODY', message: 'document.xml has no <w:body> element', severity: 'error', location: PARTS.document });
    }

    return { name: 'Required Parts', passed: entries.filter(e => e.severity === 'error').length === 0, entries };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _tryParseXml(xml: string): { ok: boolean; error?: string } {
    try {
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const parseError = doc.getElementsByTagName('parsererror')[0];
      if (parseError) {
        return { ok: false, error: parseError.textContent?.slice(0, 200) ?? 'parse error' };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  }
}
