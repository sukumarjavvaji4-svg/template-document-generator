import {
  PipelineContext, PipelineModule, MergeConstraints, MergePlan,
  MergeItem, RelAddition, StyleAddition, NumberingAddition,
  FootnoteAddition, TemplateModel, ContentModel, UserConstraints,
  RelEntry, ConstraintConflict, StrategyLogEntry,
} from '../types';
import { REL_TYPES } from '../utils/ooxml';
import { ArchiveParser } from './ArchiveParser';

// ─── Merge Planner ────────────────────────────────────────────────────────────
// Stage 5: Creates a complete MergePlan — all ID remappings, all content order,
// all relationship additions. No XML is modified here.

export class MergePlanner implements PipelineModule {
  readonly name = 'MergePlanner';

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    ctx.onProgress('Planning merge', 44);
    ctx.mergePlan = this.plan(
      ctx.templateModel!,
      ctx.contentModels!,
      ctx.mergeConstraints!,
      ctx.recoveryLog as any
    );
    ctx.onProgress('Merge planned', 52);
    return ctx;
  }

  plan(
    templateModel: TemplateModel,
    contentModels: ContentModel[],
    mergeConstraints: MergeConstraints,
    recoveryLog: any[]
  ): MergePlan {
    const constraints = mergeConstraints.userConstraints;

    // ── New rel ID generator (never conflicts with template) ──────────────
    let nextRelNum = templateModel.maxRelIdNumber + 1;
    const usedRelIds = new Set(templateModel.documentRels.map(r => r.id));
    const makeRelId = () => {
      let id: string;
      do { id = `rId${nextRelNum++}`; } while (usedRelIds.has(id));
      usedRelIds.add(id);
      return id;
    };

    // ── New abstractNumId generator ───────────────────────────────────────
    let nextAbstractNumId = templateModel.definedAbstractNumIds.size > 0
      ? Math.max(...Array.from(templateModel.definedAbstractNumIds).map(Number)) + 1
      : 1;

    // ── New numId generator ───────────────────────────────────────────────
    let nextNumId = templateModel.definedNumIds.size > 0
      ? Math.max(...Array.from(templateModel.definedNumIds).map(Number)) + 1
      : 1;

    // ── New annotation ID generator ───────────────────────────────────────
    let nextFootnoteId = 1;
    let nextEndnoteId = 1;
    let nextCommentId = 1;
    let nextBookmarkId = 1000; // start high to avoid template bookmark ID collision

    const relAdditions: RelAddition[] = [];
    const styleAdditions: StyleAddition[] = [];
    const numberingAdditions: NumberingAddition[] = [];
    const footnoteAdditions: FootnoteAddition[] = [];
    const endnoteAdditions: FootnoteAddition[] = [];
    const commentAdditions: FootnoteAddition[] = [];
    const mergeItems: MergeItem[] = [];

    // Tracks which style IDs are in use (template + all added so far)
    const mergedStyleIds = new Set(templateModel.definedStyleIds);

    // First data doc docDefaults — used to replace template typography (Fix 2)
    let contentDocDefaultsXml: string | null = null;

    // Track section layout sequence index for multi-page pattern cycling
    let sectionIndex = 0;

    for (let docIdx = 0; docIdx < contentModels.length; docIdx++) {
      const model = contentModels[docIdx];

      // Capture first data doc's docDefaults (Fix 2: source doc controls typography)
      if (contentDocDefaultsXml === null && model.docDefaultsXml) {
        contentDocDefaultsXml = model.docDefaultsXml;
      }

      // ── 1. Plan relationship remapping for this doc ───────────────────
      const relIdMap = new Map<string, string>(); // old → new

      for (const rel of model.documentRels) {
        // Skip header/footer rels from data docs (not used)
        if (rel.type === REL_TYPES.header || rel.type === REL_TYPES.footer) continue;

        // Skip package-level singleton parts already provided by the template
        const targetClean = rel.target.toLowerCase();
        if (
          rel.type === REL_TYPES.styles ||
          rel.type === REL_TYPES.numbering ||
          rel.type === REL_TYPES.settings ||
          rel.type === REL_TYPES.webSettings ||
          rel.type === REL_TYPES.fontTable ||
          rel.type === REL_TYPES.theme ||
          rel.type.includes('customXml') ||
          targetClean.endsWith('styles.xml') ||
          targetClean.endsWith('numbering.xml') ||
          targetClean.endsWith('settings.xml') ||
          targetClean.endsWith('websettings.xml') ||
          targetClean.endsWith('fonttable.xml') ||
          targetClean.includes('theme') ||
          targetClean.includes('customxml')
        ) {
          continue;
        }

        const newId = makeRelId();
        relIdMap.set(rel.id, newId);

        if (rel.type === REL_TYPES.image) {
          const oldPath = ArchiveParser.resolveTarget('word/document.xml', rel.target);
          const mediaData = model.media.get(oldPath);
          if (mediaData) {
            // FIX 5: also avoid template media paths to prevent overwriting template assets
            // (e.g. the template logo at word/media/image1.png must never be replaced)
            const newPath = this._uniqueMediaPath(oldPath, relAdditions, templateModel.templateMediaPaths);
            relAdditions.push({
              newId,
              type: rel.type,
              target: this._pathToRelTarget(newPath),
              mediaPath: newPath,
              mediaData,
            });
          }
          // If media not found: relId mapping exists but no rel addition → drawing will be repaired by MergeEngine
        } else if (rel.targetMode === 'External') {
          relAdditions.push({ newId, type: rel.type, target: rel.target, targetMode: 'External' });
        } else if (
          rel.type === REL_TYPES.hyperlink ||
          rel.type === REL_TYPES.chart ||
          rel.type === REL_TYPES.oleObject
        ) {
          relAdditions.push({ newId, type: rel.type, target: rel.target });
        }
      }

      // ── 2. Plan style additions (Fix 1: preserve source doc style definitions) ────
      //
      // POLICY: The source document controls content formatting.
      //   If a data doc style has the same ID as a template style, we ALWAYS
      //   add the data doc version under a renamed ID and remap all body references.
      //   This ensures headings/body text from the data doc keep their formatting.
      //
      // Without this: template's Heading1 (with template font/color) silently replaces
      //   the data doc's Heading1, causing wrong colors, sizes, and lost bold/italic.
      const styleIdMap = new Map<string, string>(); // old styleId → final styleId in merged doc

      for (const [styleId, rawXml] of model.definedStyleIds) {
        if (mergedStyleIds.has(styleId)) {
          // CONFLICT: both template and data doc define this style ID.
          // RESOLUTION: Always add the data doc version with a renamed ID.
          // Remap all body references to the new ID via substitutions.
          const newId = this._uniqueStyleId(styleId, mergedStyleIds);
          mergedStyleIds.add(newId);
          styleIdMap.set(styleId, newId);
          // Update w:styleId in the style element itself (MUST match the renamed ID)
          const renamedXml = rawXml.replace(/w:styleId="[^"]*"/, `w:styleId="${newId}"`);
          styleAdditions.push({ xmlString: renamedXml, styleId: newId });
        } else {
          // No conflict — add as-is, no renaming needed
          mergedStyleIds.add(styleId);
          styleIdMap.set(styleId, styleId);
          styleAdditions.push({ xmlString: rawXml, styleId });
        }
      }

      // ── Fix 4: Update cross-references inside renamed style definitions ──────
      //
      // When we rename conflicting styles (e.g. Normal→Normal_d, ListBullet→ListBullet_d),
      // the inner XML of ListBullet_d still contains <w:basedOn w:val="Normal"/>.
      // But "Normal" now refers to the TEMPLATE's Normal, not the source doc's Normal_d.
      // This causes list indentation to be inherited from the template, not the source doc.
      //
      // FIX: After the full styleIdMap is built for this document, post-process all
      // newly-added style entries and rewrite basedOn/next/link references that
      // point to source doc styles we've renamed.
      //
      // styleAdditions may include styles from previous docs, so we track the
      // start index to only update this document's newly added styles.
      const styleStartIdx = styleAdditions.length - model.definedStyleIds.size;
      for (let si = Math.max(0, styleStartIdx); si < styleAdditions.length; si++) {
        let xml = styleAdditions[si].xmlString;
        let changed = false;
        for (const [oldId, newId] of styleIdMap) {
          if (oldId === newId) continue;
          // Update w:basedOn, w:next, w:link — these are the only intra-style references
          const before = xml;
          xml = xml
            .replace(`w:basedOn w:val="${oldId}"`, `w:basedOn w:val="${newId}"`)
            .replace(`w:next w:val="${oldId}"`, `w:next w:val="${newId}"`)
            .replace(`w:link w:val="${oldId}"`, `w:link w:val="${newId}"`);
          if (xml !== before) changed = true;
        }
        if (changed) {
          styleAdditions[si] = { xmlString: xml, styleId: styleAdditions[si].styleId };
        }
      }
      // ── 3. Plan numbering remapping (Fix: complete remapping & style numId binding) ──
      const numIdMap = new Map<string, string>(); // old numId → new numId (strings)
      const abstractIdMap = new Map<number, number>(); // old abstractId → new abstractId
      const abstractXmlMap = new Map<number, string>(); // newAbstractId → remappedAbstractXml
      const pushedAbstractIds = new Set<number>(); // which new abstractIds already have their XML

      // 1. Remap all abstractNum definitions upfront
      for (const abstractXml of model.rawAbstractNums) {
        const oldIdMatch = abstractXml.match(/w:abstractNumId="([^"]*)"/);
        if (!oldIdMatch) continue;
        const oldAbsId = parseInt(oldIdMatch[1], 10);
        const newAbsId = nextAbstractNumId++;
        abstractIdMap.set(oldAbsId, newAbsId);

        // Remap w:abstractNumId in the abstractNum definition
        const remappedXml = abstractXml.replace(
          /w:abstractNumId="[^"]*"/,
          `w:abstractNumId="${newAbsId}"`
        );
        abstractXmlMap.set(newAbsId, remappedXml);
      }

      // 2. Remap all concrete num definitions and link to their remapped abstractNums
      for (const numXml of model.rawNums) {
        const numIdMatch = numXml.match(/w:numId="([^"]*)"/);
        if (!numIdMatch) continue;
        const oldNumId = numIdMatch[1];
        if (numIdMap.has(oldNumId)) continue; // already mapped

        const newNumId = nextNumId++;
        numIdMap.set(oldNumId, String(newNumId));

        const absRefMatch = numXml.match(/<w:abstractNumId[^>]*w:val="([^"]*)"/);
        let newAbsId: number | null = null;
        if (absRefMatch) {
          const oldAbsId = parseInt(absRefMatch[1], 10);
          newAbsId = abstractIdMap.get(oldAbsId) ?? null;
        }

        let remappedNumXml = numXml.replace(/w:numId="[^"]*"/, `w:numId="${newNumId}"`);
        if (newAbsId !== null) {
          remappedNumXml = remappedNumXml.replace(
            /<w:abstractNumId([^>]*)w:val="[^"]*"/,
            `<w:abstractNumId$1w:val="${newAbsId}"`
          );
        }

        const abstractXmlToPush = (newAbsId !== null && !pushedAbstractIds.has(newAbsId))
          ? (abstractXmlMap.get(newAbsId) || '')
          : '';

        if (newAbsId !== null) {
          pushedAbstractIds.add(newAbsId);
        }

        numberingAdditions.push({
          abstractNumXml: abstractXmlToPush,
          numXml: remappedNumXml,
          newAbstractId: newAbsId ?? 0,
          newNumId,
        });
      }

      // ── 3b. Update numId references inside newly-added style definitions ──────
      // Single-pass regex replacement prevents cascading substitution (e.g. 1->2 then 2->3 ... ->24)
      for (let si = Math.max(0, styleStartIdx); si < styleAdditions.length; si++) {
        let xml = styleAdditions[si].xmlString;
        xml = xml.replace(/\bw:numId\s+w:val="([^"]+)"/g, (m, oldId) => {
          const newId = numIdMap.get(oldId);
          return newId ? `w:numId w:val="${newId}"` : m;
        });
        styleAdditions[si] = { xmlString: xml, styleId: styleAdditions[si].styleId };
      }

      // ── 4. Plan footnote remapping ────────────────────────────────────
      const footnoteIdMap = new Map<string, string>();
      for (const [oldId, rawXml] of model.footnotes) {
        const newId = String(nextFootnoteId++);
        footnoteIdMap.set(oldId, newId);
        footnoteAdditions.push({
          xmlString: rawXml.replace(/w:id="[^"]*"/, `w:id="${newId}"`),
          newId,
        });
      }

      // ── 5. Plan endnote remapping ─────────────────────────────────────
      const endnoteIdMap = new Map<string, string>();
      for (const [oldId, rawXml] of model.endnotes) {
        const newId = String(nextEndnoteId++);
        endnoteIdMap.set(oldId, newId);
        endnoteAdditions.push({
          xmlString: rawXml.replace(/w:id="[^"]*"/, `w:id="${newId}"`),
          newId,
        });
      }

      // ── 6. Plan comment remapping ─────────────────────────────────────
      const commentIdMap = new Map<string, string>();
      for (const [oldId, rawXml] of model.comments) {
        const newId = String(nextCommentId++);
        commentIdMap.set(oldId, newId);
        commentAdditions.push({
          xmlString: rawXml.replace(/w:id="[^"]*"/, `w:id="${newId}"`),
          newId,
        });
      }

      // ── 7. Build substitution list for each body node ─────────────────
      //
      // Substitutions are [oldToken, newToken] pairs applied via replaceAll.
      // The order matters: apply longer/more specific tokens first.

      const buildSubstitutions = (
        relIdMap: Map<string, string>,
        styleIdMap: Map<string, string>,
        numIdMap: Map<string, string>,
        footnoteIdMap: Map<string, string>,
        endnoteIdMap: Map<string, string>,
        commentIdMap: Map<string, string>,
        bookmarkStartId: number
      ): Array<[string, string]> => {
        const subs: Array<[string, string]> = [];

        // Rel IDs — replace in various attribute positions
        for (const [oldId, newId] of relIdMap) {
          // Match r:id="...", r:embed="...", r:link="..."
          subs.push([`r:id="${oldId}"`, `r:id="${newId}"`]);
          subs.push([`r:embed="${oldId}"`, `r:embed="${newId}"`]);
          subs.push([`r:link="${oldId}"`, `r:link="${newId}"`]);
          subs.push([`r:href="${oldId}"`, `r:href="${newId}"`]);
        }

        // Style IDs
        for (const [oldId, newId] of styleIdMap) {
          if (oldId !== newId) {
            subs.push([`w:pStyle w:val="${oldId}"`, `w:pStyle w:val="${newId}"`]);
            subs.push([`w:rStyle w:val="${oldId}"`, `w:rStyle w:val="${newId}"`]);
            subs.push([`w:tblStyle w:val="${oldId}"`, `w:tblStyle w:val="${newId}"`]);
          }
        }

        // NumIds — single-pass regex replacement prevents cascading substitution (e.g. 1->2 then 2->3 ... ->24)
        // (Handled directly via single-pass regex in node loop)

        // Footnote refs
        for (const [oldId, newId] of footnoteIdMap) {
          subs.push([`w:footnoteReference w:id="${oldId}"`, `w:footnoteReference w:id="${newId}"`]);
        }

        // Endnote refs
        for (const [oldId, newId] of endnoteIdMap) {
          subs.push([`w:endnoteReference w:id="${oldId}"`, `w:endnoteReference w:id="${newId}"`]);
        }

        // Comment refs
        for (const [oldId, newId] of commentIdMap) {
          subs.push([`w:commentReference w:id="${oldId}"`, `w:commentReference w:id="${newId}"`]);
          subs.push([`w:commentRangeStart w:id="${oldId}"`, `w:commentRangeStart w:id="${newId}"`]);
          subs.push([`w:commentRangeEnd w:id="${oldId}"`, `w:commentRangeEnd w:id="${newId}"`]);
        }

        return subs;
      };

      let bookmarkIdStart = nextBookmarkId;
      const bookmarkSubs: Array<[string, string]> = [];
      for (const [oldBmId, name] of model.bookmarks) {
        const newBmId = String(nextBookmarkId++);
        bookmarkSubs.push([`w:bookmarkStart w:id="${oldBmId}"`, `w:bookmarkStart w:id="${newBmId}"`]);
        bookmarkSubs.push([`w:bookmarkEnd w:id="${oldBmId}"`, `w:bookmarkEnd w:id="${newBmId}"`]);
      }

      const substitutions = buildSubstitutions(
        relIdMap, styleIdMap, numIdMap,
        footnoteIdMap, endnoteIdMap, commentIdMap,
        bookmarkIdStart
      );
      substitutions.push(...bookmarkSubs);

      // ── 8. Build merge items for each body node ───────────────────────
      const pattern = templateModel.patternModel ?? {
        layouts: [templateModel.documentSectPrXml],
        length: 1,
      };

      for (const node of model.nodes) {
        let xmlStr = node.xmlString;

        // Single-pass NumId replacement to prevent cascading substitution (e.g. 1->2 then 2->3 ... ->24)
        xmlStr = xmlStr.replace(/\bw:numId\s+w:val="([^"]+)"/g, (m, oldId) => {
          const newId = numIdMap.get(oldId);
          return newId ? `w:numId w:val="${newId}"` : m;
        });

        // Ensure paragraphs without explicit w:pStyle bind to the source doc's remapped Normal style
        // so typography (font family & font size) from the data doc is preserved instead of template default
        const remappedNormalId = styleIdMap.get('Normal');
        if (remappedNormalId && remappedNormalId !== 'Normal' && node.kind === 'paragraph' && !xmlStr.includes('w:pStyle')) {
          if (xmlStr.includes('<w:pPr>')) {
            xmlStr = xmlStr.replace('<w:pPr>', `<w:pPr><w:pStyle w:val="${remappedNormalId}"/>`);
          } else if (xmlStr.includes('<w:pPr/>')) {
            xmlStr = xmlStr.replace('<w:pPr/>', `<w:pPr><w:pStyle w:val="${remappedNormalId}"/></w:pPr>`);
          } else {
            xmlStr = xmlStr.replace(/<w:p\b([^>]*)>/, `<w:p$1><w:pPr><w:pStyle w:val="${remappedNormalId}"/></w:pPr>`);
          }
        }

        // Apply constraint transformations (string-level)
        xmlStr = this._applyConstraints(xmlStr, node.kind, constraints);

        // If template has a multi-page pattern (length > 1) and node has an explicit page break,
        // convert page break to pattern section break to transition to the next layout in pattern
        if (pattern.length > 1 && (xmlStr.includes('<w:br w:type="page"/>') || xmlStr.includes('<w:br  w:type="page"/>'))) {
          const currentLayout = pattern.layouts[sectionIndex % pattern.length];
          const breakType = constraints.sectionBreakType || 'nextPage';
          const sectPara = this._buildSectionBreakPara(breakType, currentLayout);
          xmlStr = xmlStr
            .replace(/<w:br\s+w:type="page"\/>/g, '')
            .replace(/<w:br\s+w:type="page"\s*\/?>/g, '');
          mergeItems.push({
            sourceDocIdx: docIdx,
            xmlString: xmlStr,
            substitutions,
          });
          mergeItems.push({
            sourceDocIdx: docIdx,
            xmlString: sectPara,
            substitutions: [],
          });
          sectionIndex++;
          continue;
        }

        mergeItems.push({
          sourceDocIdx: docIdx,
          xmlString: xmlStr,
          substitutions,
        });
      }

      // Insert section break between docs (not after last).
      // Uses the current section layout from the pattern sequence.
      if (constraints.insertSectionBreakBetweenDocs && docIdx < contentModels.length - 1) {
        const breakType = constraints.sectionBreakType;
        const currentLayout = pattern.layouts[sectionIndex % pattern.length];
        mergeItems.push({
          sourceDocIdx: docIdx,
          xmlString: this._buildSectionBreakPara(breakType, currentLayout),
          substitutions: [],
        });
        sectionIndex++;
      }
    }

    // Compute the final section layout for the end of <w:body>
    const pattern = templateModel.patternModel ?? {
      layouts: [templateModel.documentSectPrXml],
      length: 1,
    };
    const finalSectPrXml = pattern.layouts[sectionIndex % pattern.length] || templateModel.documentSectPrXml;

    return {
      mergeItems,
      relAdditions,
      styleAdditions,
      numberingAdditions,
      footnoteAdditions,
      endnoteAdditions,
      commentAdditions,
      needsNumberingPart: numberingAdditions.length > 0 || templateModel.numberingXmlRaw !== null,
      needsFootnotesPart: footnoteAdditions.length > 0,
      needsEndnotesPart: endnoteAdditions.length > 0,
      needsCommentsPart: commentAdditions.length > 0,
      contentDocDefaultsXml, // Fix 2: replace template docDefaults with source doc typography
      finalSectPrXml,
    };
  }

  // ─── Section break paragraph builder ────────────────────────────────────────
  //
  // A section break paragraph's <w:sectPr> defines the properties for the SECTION
  // that ENDS at that paragraph. An empty sectPr creates a section with default
  // (empty) headers/footers and Letter page size, losing the template layout.
  //
  // This method extracts the template's FULL page properties from documentSectPrXml
  // and injects them into the section break, changing only <w:type>.
  // Result: every section in the document has identical page properties to the template.

  private _buildSectionBreakPara(breakType: string, templateSectPrXml: string): string {
    // Extract the inner content of the template's <w:sectPr> (between opening > and </w:sectPr>)
    // That inner content has: <w:pgSz/>, <w:pgMar/>, <w:pgBorders/>,
    // <w:headerReference/>, <w:footerReference/>, <w:cols/>, <w:docGrid/>, etc.

    if (!templateSectPrXml) {
      return `<w:p><w:pPr><w:sectPr><w:type w:val="${breakType}"/></w:sectPr></w:pPr></w:p>`;
    }

    // Check if self-closing: <w:sectPr .../>
    const trimmed = templateSectPrXml.trim();
    if (trimmed.endsWith('/>')) {
      return `<w:p><w:pPr><w:sectPr><w:type w:val="${breakType}"/></w:sectPr></w:pPr></w:p>`;
    }

    // Find where the opening <w:sectPr ...> tag ends
    const openEnd = templateSectPrXml.indexOf('>');
    if (openEnd < 0) {
      return `<w:p><w:pPr><w:sectPr><w:type w:val="${breakType}"/></w:sectPr></w:pPr></w:p>`;
    }

    // Find where </w:sectPr> starts
    const closeStart = templateSectPrXml.lastIndexOf('</w:sectPr>');
    if (closeStart < 0) {
      return `<w:p><w:pPr><w:sectPr><w:type w:val="${breakType}"/></w:sectPr></w:pPr></w:p>`;
    }

    // Extract everything INSIDE the sectPr tags
    let inner = templateSectPrXml.slice(openEnd + 1, closeStart);

    // Remove any existing <w:type> element (we'll add the correct one)
    inner = inner.replace(/<w:type\b[^>]*\/>/g, '');
    inner = inner.replace(/<w:type\b[^>]*>[\s\S]*?<\/w:type>/g, '');

    // Build the complete section break paragraph:
    // <w:type> FIRST (per OOXML schema), then all other template page properties
    const sectPrContent = `<w:type w:val="${breakType}"/>${inner}`;

    return `<w:p><w:pPr><w:sectPr>${sectPrContent}</w:sectPr></w:pPr></w:p>`;
  }



  private _applyConstraints(
    xml: string,
    kind: string,
    constraints: UserConstraints
  ): string {
    if (!constraints.pageLimitEnabled) return xml;

    let result = xml;
    for (const strategy of constraints.constraintStrategies) {
      result = this._applyStrategy(result, kind, strategy, constraints);
    }
    return result;
  }

  private _applyStrategy(
    xml: string,
    kind: string,
    strategy: string,
    constraints: UserConstraints
  ): string {
    switch (strategy) {
      case 'resize-images': {
        const maxW = constraints.maxImageWidthEmu;
        const maxH = constraints.maxImageHeightEmu;
        const minScale = constraints.minImageScalePercent / 100;
        // Replace cx="N" cy="M" where N > maxW
        return xml.replace(/cx="(\d+)"\s+cy="(\d+)"/g, (match, cxStr, cyStr) => {
          let cx = parseInt(cxStr, 10), cy = parseInt(cyStr, 10);
          if (cx > maxW && maxW / cx >= minScale) {
            const scale = maxW / cx;
            cx = Math.round(cx * scale);
            cy = Math.round(cy * scale);
          }
          if (cy > maxH && maxH / cy >= minScale) {
            const scale = maxH / cy;
            cx = Math.round(cx * scale);
            cy = Math.round(cy * scale);
          }
          return `cx="${cx}" cy="${cy}"`;
        });
      }
      case 'reduce-paragraph-spacing': {
        return xml.replace(/(<w:spacing\b[^>]*)\bw:before="(\d+)"/g, (m, prefix, v) =>
          `${prefix}w:before="${Math.round(parseInt(v, 10) * 0.8)}"`)
          .replace(/(<w:spacing\b[^>]*)\bw:after="(\d+)"/g, (m, prefix, v) =>
            `${prefix}w:after="${Math.round(parseInt(v, 10) * 0.8)}"`);
      }
      case 'reduce-line-spacing': {
        return xml.replace(/(<w:spacing\b[^>]*)\bw:line="(\d+)"/g, (m, prefix, v) => {
          const val = parseInt(v, 10);
          if (val <= 240) return m; // don't compress below single
          return `${prefix}w:line="${Math.max(240, Math.round(val * 0.9))}"`;
        });
      }
      case 'reduce-font-size': {
        const minHp = constraints.minFontSizePt * 2;
        const maxHp = constraints.maxFontSizePt * 2;
        return xml.replace(/<w:sz\s+w:val="(\d+)"/g, (m, v) => {
          const val = parseInt(v, 10);
          const reduced = Math.max(minHp, Math.min(maxHp, Math.round(val * 0.9)));
          return `<w:sz w:val="${reduced}"`;
        }).replace(/<w:szCs\s+w:val="(\d+)"/g, (m, v) => {
          const val = parseInt(v, 10);
          const reduced = Math.max(minHp, Math.min(maxHp, Math.round(val * 0.9)));
          return `<w:szCs w:val="${reduced}"`;
        });
      }
      case 'reduce-table-padding': {
        if (kind !== 'table') return xml;
        return xml.replace(/<w:tcMar\b([^>]*)>/g, (m, attrs) => {
          // This is simplified — actual cell margin changes are inside child elements
          return m;
        });
      }
      default:
        return xml;
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  /**
   * Return a media path for a data doc image that doesn't collide with:
   *   - other already-planned data doc media (relAdditions)
   *   - template media (templateMediaPaths)
   *
   * FIX 5: Without checking templateMediaPaths, a data doc image at
   *   word/media/image1.png silently overwrites the template's logo at
   *   the same path. PackageBuilder copies template files first and then
   *   writes model.media — so any collision replaces the template asset.
   */
  private _uniqueMediaPath(
    originalPath: string,
    existing: RelAddition[],
    templateMediaPaths: Set<string> = new Set()
  ): string {
    const usedPaths = new Set([
      ...existing.map(r => r.mediaPath).filter(Boolean) as string[],
      ...templateMediaPaths,
    ]);
    if (!usedPaths.has(originalPath)) return originalPath;
    const lastDot = originalPath.lastIndexOf('.');
    const ext = lastDot >= 0 ? originalPath.slice(lastDot) : '';
    const base = lastDot >= 0 ? originalPath.slice(0, lastDot) : originalPath;
    let i = 2;
    let newPath = `${base}_${i}${ext}`;
    while (usedPaths.has(newPath)) newPath = `${base}_${++i}${ext}`;
    return newPath;
  }

  private _pathToRelTarget(fullPath: string): string {
    if (fullPath.startsWith('word/')) return fullPath.slice(5);
    return fullPath;
  }

  private _uniqueStyleId(base: string, existing: Set<string>): string {
    let id = base + '_d';
    let i = 2;
    while (existing.has(id)) id = `${base}_d${i++}`;
    return id;
  }
}
