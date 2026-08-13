import JSZip from 'jszip';
import {
  PipelineContext, PipelineModule, DocumentModel, GenerationReport,
  TemplateModel, ContentModel, MergeConstraints, MergePlan,
  ValidationReport, RelEntry,
} from '../types';
import { PARTS, CONTENT_TYPES, REL_TYPES } from '../utils/ooxml';

// ─── Package Builder ──────────────────────────────────────────────────────────
// Stage 9: Packages the DocumentModel into a valid .docx ZIP.
// CRITICAL: Starts with the TEMPLATE archive and only replaces modified parts.
// Preserves all unmodified template files byte-for-byte.

export class PackageBuilder implements PipelineModule {
  readonly name = 'PackageBuilder';

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    ctx.onProgress('Building package', 87);
    const startMs = Date.now();

    const { blob, fileName } = await this.buildPackage(
      ctx.documentModel!,
      ctx.templateArchive!,
      ctx.templateModel!
    );

    // Stage 9: Perform post-packaging ZIP validation on the generated Final.docx
    await this._validateOutputZip(blob, ctx);

    const report = this._buildReport(ctx, startMs, Date.now(), fileName);
    ctx.generationReport = report;

    // Only attach outputBlob if validation passed (no fatal errors)
    if (report.status !== 'failed') {
      ctx.outputBlob = blob;
    } else {
      ctx.outputBlob = undefined;
    }

    ctx.onProgress('Package ready', 100);
    return ctx;
  }

  // ─── Post-Packaging ZIP Package Re-Validation ──────────────────────────────

  private async _validateOutputZip(blob: Blob, ctx: PipelineContext): Promise<void> {
    if (!ctx.validationReport) {
      ctx.validationReport = {
        valid: true,
        checks: [],
        entries: [],
        errorCount: 0,
        warningCount: 0,
        repairedCount: 0,
      };
    }

    const report = ctx.validationReport;

    try {
      const generatedZip = await JSZip.loadAsync(blob);

      // Check required XML files exist in output ZIP
      const docXmlEntry = generatedZip.file(PARTS.document);
      const relsXmlEntry = generatedZip.file(PARTS.documentRels);
      const contentTypesEntry = generatedZip.file(PARTS.contentTypes);

      if (!docXmlEntry) {
        report.entries.push({
          code: 'FATAL_ZIP_MISSING_DOCUMENT_XML',
          message: 'Output DOCX ZIP package is missing word/document.xml',
          severity: 'error',
          location: PARTS.document,
        });
      }

      if (!relsXmlEntry) {
        report.entries.push({
          code: 'FATAL_ZIP_MISSING_RELS',
          message: 'Output DOCX ZIP package is missing word/_rels/document.xml.rels',
          severity: 'error',
          location: PARTS.documentRels,
        });
      }

      if (!contentTypesEntry) {
        report.entries.push({
          code: 'FATAL_ZIP_MISSING_CONTENT_TYPES',
          message: 'Output DOCX ZIP package is missing [Content_Types].xml',
          severity: 'error',
          location: PARTS.contentTypes,
        });
      }

      // Verify all relationship targets in document.xml.rels exist in the generated ZIP
      if (relsXmlEntry) {
        const relsXmlStr = await relsXmlEntry.async('string');
        const parser = new DOMParser();
        const relsDom = parser.parseFromString(relsXmlStr, 'application/xml');
        const relElements = Array.from(relsDom.querySelectorAll('Relationship'));

        for (const relEl of relElements) {
          const id = relEl.getAttribute('Id') ?? '';
          const target = relEl.getAttribute('Target') ?? '';
          const targetMode = relEl.getAttribute('TargetMode');

          if (targetMode === 'External') continue;
          if (!target) continue;

          // Target path relative to word/
          const fullPath = target.startsWith('/') ? target.slice(1) : `word/${target}`;
          const targetEntry = generatedZip.file(fullPath);

          if (!targetEntry) {
            report.entries.push({
              code: 'FATAL_PACKAGE_DANGLING_REL_TARGET',
              message: `Relationship "${id}" points to missing package file "${fullPath}". Microsoft Word will flag unreadable content.`,
              severity: 'error',
              location: PARTS.documentRels,
            });
          }
        }
      }

      // Re-calculate counts and valid flag
      report.errorCount = report.entries.filter(e => e.severity === 'error').length;
      report.warningCount = report.entries.filter(e => e.severity === 'warning').length;
      report.repairedCount = report.entries.filter(e => e.severity === 'repaired').length;
      report.valid = report.errorCount === 0;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      report.entries.push({
        code: 'FATAL_ZIP_CORRUPTION',
        message: `Output package ZIP file is corrupt or unreadable: ${msg}`,
        severity: 'error',
        location: 'Final.docx',
      });
      report.errorCount = report.entries.filter(e => e.severity === 'error').length;
      report.valid = false;
    }
  }

  async buildPackage(
    model: DocumentModel,
    templateArchive: import('../types').DocxArchive,
    templateModel: TemplateModel
  ): Promise<{ blob: Blob; fileName: string }> {

    const zip = new JSZip();

    // ── 1. Copy ALL template files first ─────────────────────────────────
    // This is the "surgical replacement" approach — start with the full
    // template and only overwrite the parts we've modified.
    const copyTasks: Promise<void>[] = [];
    templateArchive.zip.forEach((path, entry) => {
      if (entry.dir) return;
      if (this._isGeneratedPart(path, model)) return; // will be overwritten
      copyTasks.push(
        entry.async('uint8array').then(data => { zip.file(path, data); })
      );
    });
    await Promise.all(copyTasks);

    // ── 2. Write generated document.xml ──────────────────────────────────
    zip.file(PARTS.document, model.documentXml);

    // ── 3. Write styles.xml ───────────────────────────────────────────────
    zip.file(PARTS.styles, model.stylesXml);

    // ── 4. Write optional parts (only if we have content) ────────────────
    if (model.numberingXml) zip.file(PARTS.numbering, model.numberingXml);
    if (model.settingsXml) zip.file(PARTS.settings, model.settingsXml);
    if (model.fontTableXml) zip.file(PARTS.fontTable, model.fontTableXml);
    if (model.webSettingsXml) zip.file(PARTS.webSettings, model.webSettingsXml);
    if (model.footnotesXml) zip.file(PARTS.footnotes, model.footnotesXml);
    if (model.endnotesXml) zip.file(PARTS.endnotes, model.endnotesXml);
    if (model.commentsXml) zip.file(PARTS.comments, model.commentsXml);

    // ── 5. Write headers and footers ─────────────────────────────────────
    for (const [path, xml] of model.headers) zip.file(path, xml);
    for (const [path, xml] of model.footers) zip.file(path, xml);

    // ── 6. Write media files (data document images) ───────────────────────
    for (const [path, data] of model.media) zip.file(path, data);

    // ── 7. Write document.xml.rels ────────────────────────────────────────
    zip.file(PARTS.documentRels, this._serializeRels(model.documentRels));

    // ── 8. Write [Content_Types].xml ─────────────────────────────────────
    const contentTypesXml = await this._buildContentTypes(zip, model, templateArchive);
    zip.file(PARTS.contentTypes, contentTypesXml);

    // ── 9. Generate ZIP blob ──────────────────────────────────────────────
    const blob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    return { blob, fileName: 'Final.docx' };
  }

  // ─── Is a part being replaced by a generated version? ────────────────────

  private _isGeneratedPart(path: string, model: DocumentModel): boolean {
    const generatedParts = new Set<string>([
      PARTS.document as string,
      PARTS.styles as string,
      PARTS.documentRels as string,
      PARTS.contentTypes as string,
    ]);
    if (model.numberingXml) generatedParts.add(PARTS.numbering as string);
    if (model.settingsXml) generatedParts.add(PARTS.settings as string);
    if (model.fontTableXml) generatedParts.add(PARTS.fontTable as string);
    if (model.webSettingsXml) generatedParts.add(PARTS.webSettings as string);
    if (model.footnotesXml) generatedParts.add(PARTS.footnotes as string);
    if (model.endnotesXml) generatedParts.add(PARTS.endnotes as string);
    if (model.commentsXml) generatedParts.add(PARTS.comments as string);

    if (generatedParts.has(path)) return true;
    if (model.headers.has(path) || model.footers.has(path)) return true;
    if (model.media.has(path)) return true;
    return false;
  }

  // ─── Relationship serializer ──────────────────────────────────────────────

  private _serializeRels(rels: RelEntry[]): string {
    const lines = rels
      .filter(r => r.id && r.type && r.target)
      .map(r => {
        const modeAttr = r.targetMode === 'External' ? ' TargetMode="External"' : '';
        return `  <Relationship Id="${this._escXml(r.id)}" Type="${this._escXml(r.type)}" Target="${this._escXml(r.target)}"${modeAttr}/>`;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${lines}
</Relationships>`;
  }

  // ─── Content Types builder ────────────────────────────────────────────────

  private async _buildContentTypes(
    zip: JSZip,
    model: DocumentModel,
    templateArchive: import('../types').DocxArchive
  ): Promise<string> {
    // Start with template's Content_Types.xml defaults/overrides
    const defaults: Record<string, string> = {
      rels: 'application/vnd.openxmlformats-package.relationships+xml',
      xml: 'application/xml',
    };
    const overrides: Record<string, string> = {};

    // Parse template content types if available
    const tmplCt = templateArchive.rawXmlParts.get(PARTS.contentTypes);
    if (tmplCt) {
      const ctNs = 'http://schemas.openxmlformats.org/package/2006/content-types';
      try {
        const doc = new DOMParser().parseFromString(tmplCt, 'application/xml');
        for (const el of Array.from(doc.getElementsByTagNameNS(ctNs, 'Default'))) {
          const ext = el.getAttribute('Extension'), ct = el.getAttribute('ContentType');
          if (ext && ct) defaults[ext] = ct;
        }
        for (const el of Array.from(doc.getElementsByTagNameNS(ctNs, 'Override'))) {
          const pn = el.getAttribute('PartName'), ct = el.getAttribute('ContentType');
          if (pn && ct) overrides[pn] = ct;
        }
      } catch { /* use defaults */ }
    }

    // ── Ensure all our generated parts have correct content types ──────────
    overrides[`/${PARTS.document}`] = CONTENT_TYPES.document;
    overrides[`/${PARTS.styles}`] = CONTENT_TYPES.styles;
    if (model.numberingXml) overrides[`/${PARTS.numbering}`] = CONTENT_TYPES.numbering;
    if (model.settingsXml) overrides[`/${PARTS.settings}`] = CONTENT_TYPES.settings;
    if (model.fontTableXml) overrides[`/${PARTS.fontTable}`] = CONTENT_TYPES.fontTable;
    if (model.webSettingsXml) overrides[`/${PARTS.webSettings}`] = CONTENT_TYPES.webSettings;
    if (model.footnotesXml) overrides[`/${PARTS.footnotes}`] = CONTENT_TYPES.footnotes;
    if (model.endnotesXml) overrides[`/${PARTS.endnotes}`] = CONTENT_TYPES.endnotes;
    if (model.commentsXml) overrides[`/${PARTS.comments}`] = CONTENT_TYPES.comments;

    for (const path of model.headers.keys()) overrides[`/${path}`] = CONTENT_TYPES.header;
    for (const path of model.footers.keys()) overrides[`/${path}`] = CONTENT_TYPES.footer;

    // Theme parts (from template)
    for (const path of model.themePartPaths) {
      overrides[`/${path}`] = CONTENT_TYPES.theme;
    }

    // ── Add image content type defaults ────────────────────────────────────
    const extToMime: Record<string, string> = {
      png: CONTENT_TYPES.pngImage, jpg: CONTENT_TYPES.jpegImage,
      jpeg: CONTENT_TYPES.jpegImage, gif: CONTENT_TYPES.gifImage,
      bmp: CONTENT_TYPES.bmpImage, tiff: CONTENT_TYPES.tiffImage,
      emf: CONTENT_TYPES.emfImage, wmf: CONTENT_TYPES.wmfImage,
      svg: CONTENT_TYPES.svgImage,
    };
    for (const path of model.media.keys()) {
      const ext = path.split('.').pop()?.toLowerCase() ?? '';
      if (extToMime[ext] && !defaults[ext]) defaults[ext] = extToMime[ext];
    }

    const defaultLines = Object.entries(defaults)
      .map(([ext, ct]) => `  <Default Extension="${ext}" ContentType="${this._escXml(ct)}"/>`)
      .join('\n');

    const overrideLines = Object.entries(overrides)
      .map(([pn, ct]) => `  <Override PartName="${pn}" ContentType="${this._escXml(ct)}"/>`)
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
${defaultLines}
${overrideLines}
</Types>`;
  }

  private _escXml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─── Generation Report ────────────────────────────────────────────────────

  private _buildReport(
    ctx: PipelineContext,
    startMs: number,
    endMs: number,
    fileName: string
  ): GenerationReport {
    const validation = ctx.validationReport!;
    const plan = ctx.mergePlan!;
    const mergeConstraints = ctx.mergeConstraints!;

    const imageCount = plan ? plan.relAdditions.filter(r => r.mediaPath).length : 0;
    const hasErrors = validation.errorCount > 0 || !validation.valid;
    const statusWithWarnings = validation.warningCount > 0 || mergeConstraints.conflicts.length > 0;

    const status = hasErrors
      ? 'failed'
      : statusWithWarnings
      ? 'success-with-warnings'
      : 'success';

    return {
      templateFileName: ctx.templateFile.name,
      dataFileNames: ctx.dataFiles.map(f => f.name),
      estimatedPages: mergeConstraints.pageEstimate.estimatedPages,
      sectionsDetected: ctx.templateModel!.patternModel ? ctx.templateModel!.patternModel.length : 1,
      stylesMerged: ctx.templateModel!.definedStyleIds.size,
      stylesAdded: plan.styleAdditions.length,
      relationshipsAdded: plan.relAdditions.length,
      imagesCopied: imageCount,
      footnotesCopied: plan.footnoteAdditions.length,
      endnotesCopied: plan.endnoteAdditions.length,
      commentsCopied: plan.commentAdditions.length,
      validationReport: validation,
      strategyLog: mergeConstraints.userConstraints.pageLimitEnabled
        ? mergeConstraints.userConstraints.constraintStrategies.map(s => ({
            strategy: s,
            applied: true,
            changeCount: 0,
            notes: 'Applied if page limit exceeded',
          }))
        : [],
      constraintConflicts: mergeConstraints.conflicts,
      durationMs: endMs - startMs,
      generatedAt: new Date().toISOString(),
      status,
    };
  }
}
