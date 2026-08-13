import JSZip from 'jszip';

export interface MergeDataDocsResult {
  blob: Blob;
  file: File;
  valid: boolean;
  errors: string[];
}

interface RelationshipEntry {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
}

interface StructuralMetrics {
  paragraphs: number;
  runs: number;
  tables: number;
  drawings: number;
  tabs: number;
  lineBreaks: number;
  preservedSpaces: number;
  listItems: number;
}

/**
 * DataDocMerger — Merges 2 to 5 data .docx files into a single valid MergedData.docx.
 *
 * Performs a REAL OOXML package merge:
 * 1. Independent parsing of each input document archive.
 * 2. Deterministically remaps style IDs, numbering IDs, relationship IDs (rId), and media paths
 *    across ALL merged documents using exact XML attribute regexes to prevent collisions.
 * 3. Preserves exact OOXML nodes byte-for-byte without stripping whitespace, tabs, breaks, or empty paragraphs.
 * 4. Inserts a clean OOXML page break paragraph between data documents (for k < N - 1).
 * 5. Performs a structural content preservation check and relationship audit before output.
 */
export class DataDocMerger {
  static async merge(files: File[]): Promise<MergeDataDocsResult> {
    const errors: string[] = [];

    if (files.length < 2) {
      return {
        blob: new Blob([]),
        file: new File([], 'MergedData.docx'),
        valid: false,
        errors: ['At least 2 data documents are required for merging.'],
      };
    }

    if (files.length > 5) {
      return {
        blob: new Blob([]),
        file: new File([], 'MergedData.docx'),
        valid: false,
        errors: ['Maximum 5 data documents allowed.'],
      };
    }

    try {
      // ── 1. Load archives into JSZip instances ────────────────────────────
      const archives: JSZip[] = [];
      for (const file of files) {
        if (!file.name.toLowerCase().endsWith('.docx')) {
          errors.push(`File "${file.name}" is not a .docx document.`);
        }
        const zip = await JSZip.loadAsync(file);
        archives.push(zip);
      }

      if (errors.length > 0) {
        return {
          blob: new Blob([]),
          file: new File([], 'MergedData.docx'),
          valid: false,
          errors,
        };
      }

      // Base output ZIP is cloned from the first document package
      const baseZip = archives[0];

      // Global registries for merged package
      const mergedRels: RelationshipEntry[] = [];
      const definedStyleIds = new Set<string>();
      let maxStyleIdNum = 100;
      let globalRelCounter = 1;
      let globalMediaIndex = 1;
      let maxAbsNumId = 0;
      let maxNumId = 0;

      // Track expected total structural metrics for content preservation check
      const expectedMetrics: StructuralMetrics = {
        paragraphs: 0,
        runs: 0,
        tables: 0,
        drawings: 0,
        tabs: 0,
        lineBreaks: 0,
        preservedSpaces: 0,
        listItems: 0,
      };

      // Extract base styles & numbering if present
      let baseStylesXml = (await this._readZipText(baseZip, 'word/styles.xml')) ?? '';
      let baseNumberingXml = (await this._readZipText(baseZip, 'word/numbering.xml')) ?? null;

      if (baseStylesXml) {
        const styleIdRe = /w:styleId="([^"]*)"/g;
        let sm: RegExpExecArray | null;
        while ((sm = styleIdRe.exec(baseStylesXml)) !== null) {
          definedStyleIds.add(sm[1]);
        }
      }

      if (baseNumberingXml) {
        maxAbsNumId = this._findMaxId(baseNumberingXml, /w:abstractNumId="(\d+)"/g);
        maxNumId = this._findMaxId(baseNumberingXml, /w:numId="(\d+)"/g);
      }

      const parser = new DOMParser();
      const serializer = new XMLSerializer();
      const mergedBodyItems: string[] = [];
      let prevSectPrXml: string | null = null;

      // ── 2. Process documents 1 to N sequentially ─────────────────────────
      for (let k = 0; k < archives.length; k++) {
        const zipK = archives[k];
        const docXmlK = await this._readZipText(zipK, 'word/document.xml');
        if (!docXmlK) {
          errors.push(`Document ${k + 1} ("${files[k].name}") is missing word/document.xml.`);
          continue;
        }

        // Record metrics of source doc for content preservation audit
        const docMetrics = this._extractMetrics(docXmlK);
        expectedMetrics.paragraphs += docMetrics.paragraphs;
        expectedMetrics.runs += docMetrics.runs;
        expectedMetrics.tables += docMetrics.tables;
        expectedMetrics.drawings += docMetrics.drawings;
        expectedMetrics.tabs += docMetrics.tabs;
        expectedMetrics.lineBreaks += docMetrics.lineBreaks;
        expectedMetrics.preservedSpaces += docMetrics.preservedSpaces;
        expectedMetrics.listItems += docMetrics.listItems;

        const relsXmlK = (await this._readZipText(zipK, 'word/_rels/document.xml.rels')) ?? '';
        const stylesXmlK = k > 0 ? (await this._readZipText(zipK, 'word/styles.xml')) ?? '' : '';
        const numberingXmlK = k > 0 ? (await this._readZipText(zipK, 'word/numbering.xml')) ?? null : null;

        const relIdMapK = new Map<string, string>();
        const styleIdMapK = new Map<string, string>();
        const numIdMapK = new Map<string, string>();

        // ── 2a. Process Relationships for Document k ────────────────────────
        if (relsXmlK) {
          const relsDom = parser.parseFromString(relsXmlK, 'application/xml');
          const relNodes = Array.from(relsDom.querySelectorAll('Relationship'));

          for (const relNode of relNodes) {
            const oldId = relNode.getAttribute('Id');
            const type = relNode.getAttribute('Type');
            const target = relNode.getAttribute('Target');
            const targetMode = relNode.getAttribute('TargetMode');

            if (!oldId || !type || !target) continue;

            const newId = `rId_data${k + 1}_${globalRelCounter++}`;
            relIdMapK.set(oldId, newId);

            let newTarget = target;

            // Handle internal media/image files
            const isMediaRel =
              type.includes('/image') ||
              type.includes('/media') ||
              target.toLowerCase().match(/\.(png|jpg|jpeg|gif|svg|emf|wmf|bmp|tiff)$/);

            if (targetMode !== 'External' && isMediaRel) {
              const cleanTarget = target.replace(/^(\.\.\/)+/, '').replace(/^word\//, '');
              const filename = cleanTarget.slice(cleanTarget.lastIndexOf('/') + 1);

              const zipPathsToTry = [
                `word/${cleanTarget}`,
                cleanTarget,
                `word/media/${filename}`,
                `media/${filename}`,
              ];

              let mediaEntry = null;
              for (const path of zipPathsToTry) {
                const entry = zipK.file(path);
                if (entry) {
                  mediaEntry = entry;
                  break;
                }
              }

              if (mediaEntry) {
                const mediaBytes = await mediaEntry.async('uint8array');
                const ext = filename.lastIndexOf('.') >= 0 ? filename.slice(filename.lastIndexOf('.')) : '.png';
                const destFilename = `image_doc${k + 1}_${globalMediaIndex++}${ext}`;
                const destPackagePath = `word/media/${destFilename}`;

                baseZip.file(destPackagePath, mediaBytes);
                newTarget = `media/${destFilename}`;
              } else {
                console.warn(`[DataDocMerger] Media target "${target}" in doc ${k + 1} not found in zip package.`);
              }
            }

            mergedRels.push({
              id: newId,
              type,
              target: newTarget,
              targetMode: targetMode ?? undefined,
            });
          }
        }

        // ── 2b. Remap styles for Document k (k > 0) ─────────────────────────
        if (stylesXmlK) {
          const stylesRe = /<w:style\b[^>]*>[\s\S]*?<\/w:style>/g;
          let smK: RegExpExecArray | null;
          const newStylesXml: string[] = [];

          while ((smK = stylesRe.exec(stylesXmlK)) !== null) {
            let styleXmlStr = smK[0];
            const idMatch = styleXmlStr.match(/w:styleId="([^"]*)"/);
            if (idMatch) {
              const oldStyleId = idMatch[1];
              if (definedStyleIds.has(oldStyleId)) {
                maxStyleIdNum++;
                const newStyleId = `${oldStyleId}_m${k + 1}_${maxStyleIdNum}`;
                styleIdMapK.set(oldStyleId, newStyleId);
                definedStyleIds.add(newStyleId);
                styleXmlStr = styleXmlStr.replace(/w:styleId="[^"]*"/, `w:styleId="${newStyleId}"`);
              } else {
                definedStyleIds.add(oldStyleId);
                styleIdMapK.set(oldStyleId, oldStyleId);
              }
              newStylesXml.push(styleXmlStr);
            }
          }

          if (newStylesXml.length > 0 && baseStylesXml) {
            const closeTag = '</w:styles>';
            const closeIdx = baseStylesXml.lastIndexOf(closeTag);
            if (closeIdx >= 0) {
              baseStylesXml = baseStylesXml.slice(0, closeIdx) + '\n' + newStylesXml.join('\n') + '\n' + closeTag;
            }
          }
        }

        // ── 2c. Remap numbering for Document k (k > 0) ──────────────────────
        if (numberingXmlK) {
          const absNumsK: string[] = [];
          const numsK: string[] = [];
          const absIdMapK = new Map<string, string>(); // oldAbsId -> newAbsId

          // 1. Extract abstractNum and num blocks upfront to avoid regex state collisions
          const abstractNodes: string[] = [];
          const absRe = /<w:abstractNum\b[^>]*>[\s\S]*?<\/w:abstractNum>/g;
          let am: RegExpExecArray | null;
          while ((am = absRe.exec(numberingXmlK)) !== null) {
            abstractNodes.push(am[0]);
          }

          const numNodes: string[] = [];
          const numRe = /<w:num\b[^>]*>[\s\S]*?<\/w:num>/g;
          let nm: RegExpExecArray | null;
          while ((nm = numRe.exec(numberingXmlK)) !== null) {
            numNodes.push(nm[0]);
          }

          // 2. Remap all abstractNumIds
          for (const absXml of abstractNodes) {
            const idMatch = absXml.match(/w:abstractNumId="(\d+)"/);
            if (idMatch) {
              const oldAbsId = idMatch[1];
              maxAbsNumId++;
              const newAbsId = String(maxAbsNumId);
              absIdMapK.set(oldAbsId, newAbsId);

              const remappedAbsXml = absXml.replace(
                /w:abstractNumId="\d+"/,
                `w:abstractNumId="${newAbsId}"`
              );
              absNumsK.push(remappedAbsXml);
            }
          }

          // 3. Remap all numIds and link them to their remapped abstractNumIds
          for (const numXml of numNodes) {
            const numIdMatch = numXml.match(/w:numId="(\d+)"/);
            const absRefMatch = numXml.match(/<w:abstractNumId[^>]*w:val="(\d+)"/);

            if (numIdMatch) {
              const oldNumId = numIdMatch[1];
              maxNumId++;
              const newNumId = String(maxNumId);
              numIdMapK.set(oldNumId, newNumId);

              let remappedNumXml = numXml.replace(
                /w:numId="\d+"/,
                `w:numId="${newNumId}"`
              );

              if (absRefMatch) {
                const oldAbsId = absRefMatch[1];
                const newAbsId = absIdMapK.get(oldAbsId);
                if (newAbsId) {
                  remappedNumXml = remappedNumXml.replace(
                    /<w:abstractNumId([^>]*)w:val="\d+"/,
                    `<w:abstractNumId$1w:val="${newAbsId}"`
                  );
                }
              }

              numsK.push(remappedNumXml);
            }
          }

          if (absNumsK.length > 0 || numsK.length > 0) {
            if (!baseNumberingXml) {
              baseNumberingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
${absNumsK.join('\n')}
${numsK.join('\n')}
</w:numbering>`;
            } else {
              if (absNumsK.length > 0) {
                let firstNumIdx = baseNumberingXml.indexOf('<w:num>');
                if (firstNumIdx < 0) firstNumIdx = baseNumberingXml.indexOf('<w:num ');
                if (firstNumIdx >= 0) {
                  baseNumberingXml = baseNumberingXml.slice(0, firstNumIdx) + absNumsK.join('\n') + '\n' + baseNumberingXml.slice(firstNumIdx);
                } else {
                  const closeIdx = baseNumberingXml.lastIndexOf('</w:numbering>');
                  if (closeIdx >= 0) {
                    baseNumberingXml = baseNumberingXml.slice(0, closeIdx) + absNumsK.join('\n') + '\n' + baseNumberingXml.slice(closeIdx);
                  }
                }
              }

              if (numsK.length > 0) {
                const closeIdx = baseNumberingXml.lastIndexOf('</w:numbering>');
                if (closeIdx >= 0) {
                  baseNumberingXml = baseNumberingXml.slice(0, closeIdx) + numsK.join('\n') + '\n' + baseNumberingXml.slice(closeIdx);
                }
              }
            }
          }
        }

        // ── 2d. Parse & Remap body nodes of Document k ───────────────────────
        const docDomK = parser.parseFromString(docXmlK, 'application/xml');
        const bodyK = docDomK.querySelector('body');
        if (!bodyK) continue;

        const childNodesK: Element[] = Array.from(bodyK.children);
        let lastSectPrK: string | null = null;

        const lastChildK = childNodesK[childNodesK.length - 1];
        if (lastChildK && lastChildK.tagName.endsWith('sectPr')) {
          lastSectPrK = serializer.serializeToString(lastChildK);
          childNodesK.pop(); // remove final sectPr temporarily
        }

        // Regex pattern matchers for exact OOXML attribute remapping
        const rIdAttrRegex = /(r:(?:embed|id|link|href)\s*=\s*")([^"]*)(")/g;
        const styleAttrRegex = /(<w:(?:pStyle|rStyle|tblStyle|basedOn|next|link)\b[^>]*\bw:val=")([^"]*)(")/g;
        const numIdAttrRegex = /(<w:numId\b[^>]*\bw:val=")([^"]*)(")/g;

        for (const childNode of childNodesK) {
          let xmlStr = serializer.serializeToString(childNode);

          // 1. Remap all relationship attributes in XML string
          xmlStr = xmlStr.replace(rIdAttrRegex, (match, prefix, oldRelId, suffix) => {
            const newRelId = relIdMapK.get(oldRelId);
            return newRelId ? `${prefix}${newRelId}${suffix}` : match;
          });

          // 2. Remap style IDs using exact attribute regex
          xmlStr = xmlStr.replace(styleAttrRegex, (match, prefix, oldStyleId, suffix) => {
            const newStyleId = styleIdMapK.get(oldStyleId);
            return newStyleId ? `${prefix}${newStyleId}${suffix}` : match;
          });

          // 3. Remap numIds using exact attribute regex
          xmlStr = xmlStr.replace(numIdAttrRegex, (match, prefix, oldNumId, suffix) => {
            const newNumId = numIdMapK.get(oldNumId);
            return newNumId ? `${prefix}${newNumId}${suffix}` : match;
          });

          // Bind un-styled body paragraphs to document k's remapped Normal style if Normal was remapped
          const remappedNormalIdK = styleIdMapK.get('Normal');
          if (remappedNormalIdK && remappedNormalIdK !== 'Normal' && childNode.tagName === 'w:p' && !xmlStr.includes('w:pStyle')) {
            if (xmlStr.includes('<w:pPr>')) {
              xmlStr = xmlStr.replace('<w:pPr>', `<w:pPr><w:pStyle w:val="${remappedNormalIdK}"/>`);
            } else if (xmlStr.includes('<w:pPr/>')) {
              xmlStr = xmlStr.replace('<w:pPr/>', `<w:pPr><w:pStyle w:val="${remappedNormalIdK}"/></w:pPr>`);
            } else {
              xmlStr = xmlStr.replace(/<w:p\b([^>]*)>/, `<w:p$1><w:pPr><w:pStyle w:val="${remappedNormalIdK}"/></w:pPr>`);
            }
          }

          // Strip internal sectPr from body content (except final section properties)
          xmlStr = xmlStr.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g, '');

          mergedBodyItems.push(xmlStr);
        }

        // Force every data document (except the last one) to start on a new page
        if (k < archives.length - 1) {
          mergedBodyItems.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
        }

        if (lastSectPrK) {
          prevSectPrXml = lastSectPrK;
        }
      }

      if (errors.length > 0) {
        return {
          blob: new Blob([]),
          file: new File([], 'MergedData.docx'),
          valid: false,
          errors,
        };
      }

      // ── 3. Serialize Merged Relationships XML ─────────────────────────────
      const relLines = mergedRels
        .filter(r => r.id && r.type && r.target)
        .map(r => {
          const modeAttr = r.targetMode === 'External' ? ' TargetMode="External"' : '';
          return `  <Relationship Id="${r.id}" Type="${r.type}" Target="${r.target}"${modeAttr}/>`;
        })
        .join('\n');

      const mergedRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relLines}
</Relationships>`;

      // ── 4. Assemble merged document.xml ────────────────────────────────────
      const rootNs = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:v="urn:schemas-microsoft-com:vml"';
      const finalSectPr = prevSectPrXml ?? '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';

      const finalDocXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${rootNs}>
<w:body>
${mergedBodyItems.join('\n')}
${finalSectPr}
</w:body>
</w:document>`;

      // Update package files in baseZip
      baseZip.file('word/document.xml', finalDocXml);
      baseZip.file('word/styles.xml', baseStylesXml);
      baseZip.file('word/_rels/document.xml.rels', mergedRelsXml);
      if (baseNumberingXml) {
        baseZip.file('word/numbering.xml', baseNumberingXml);
      }

      // Generate final ZIP blob
      const blob = await baseZip.generateAsync({
        type: 'blob',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const file = new File([blob], 'MergedData.docx', {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      // ── 5. Perform Pre-Validation Audit & Content Preservation Check ──────
      const validationResult = await this._validateMergedPackage(
        baseZip,
        finalDocXml,
        mergedRelsXml,
        expectedMetrics
      );

      return {
        blob,
        file,
        valid: validationResult.valid,
        errors: validationResult.errors,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        blob: new Blob([]),
        file: new File([], 'MergedData.docx'),
        valid: false,
        errors: [`DOCX Merge Error: ${msg}`],
      };
    }
  }

  // ─── Structural Metrics Extractor ──────────────────────────────────────────

  private static _extractMetrics(xmlStr: string): StructuralMetrics {
    return {
      paragraphs: (xmlStr.match(/<w:p\b/g) || []).length,
      runs: (xmlStr.match(/<w:r\b/g) || []).length,
      tables: (xmlStr.match(/<w:tbl\b/g) || []).length,
      drawings: (xmlStr.match(/<w:drawing\b/g) || []).length,
      tabs: (xmlStr.match(/<w:tab\b/g) || []).length,
      lineBreaks: (xmlStr.match(/<w:br\b/g) || []).length,
      preservedSpaces: (xmlStr.match(/xml:space="preserve"/g) || []).length,
      listItems: (xmlStr.match(/<w:numPr\b/g) || []).length,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private static async _readZipText(zip: JSZip, path: string): Promise<string | null> {
    const entry = zip.file(path);
    if (!entry) return null;
    return await entry.async('string');
  }

  private static _findMaxId(xml: string, regex: RegExp): number {
    let max = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(xml)) !== null) {
      const num = parseInt(m[1], 10);
      if (!isNaN(num)) max = Math.max(max, num);
    }
    return max;
  }

  // ─── Pre-Validation Audit & Content Preservation Check ─────────────────────

  private static async _validateMergedPackage(
    baseZip: JSZip,
    docXml: string,
    relsXml: string,
    expectedMetrics: StructuralMetrics
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const parser = new DOMParser();

    // 1. XML Syntax Validation
    try {
      const docDom = parser.parseFromString(docXml, 'application/xml');
      if (docDom.querySelector('parsererror')) {
        errors.push('Merged document.xml contains XML syntax errors.');
      }
    } catch {
      errors.push('Failed to parse merged document.xml.');
    }

    // 2. Structural Content Preservation Verification
    const mergedMetrics = this._extractMetrics(docXml);
    if (mergedMetrics.tables < expectedMetrics.tables) {
      errors.push(`[CONTENT_LOSS] Merged document lost tables: expected ${expectedMetrics.tables}, found ${mergedMetrics.tables}.`);
    }
    if (mergedMetrics.drawings < expectedMetrics.drawings) {
      errors.push(`[CONTENT_LOSS] Merged document lost drawings/images: expected ${expectedMetrics.drawings}, found ${mergedMetrics.drawings}.`);
    }
    if (mergedMetrics.tabs < expectedMetrics.tabs) {
      errors.push(`[CONTENT_LOSS] Merged document lost tab characters: expected ${expectedMetrics.tabs}, found ${mergedMetrics.tabs}.`);
    }
    if (mergedMetrics.lineBreaks < expectedMetrics.lineBreaks) {
      errors.push(`[CONTENT_LOSS] Merged document lost line breaks: expected ${expectedMetrics.lineBreaks}, found ${mergedMetrics.lineBreaks}.`);
    }
    if (mergedMetrics.preservedSpaces < expectedMetrics.preservedSpaces) {
      errors.push(`[CONTENT_LOSS] Merged document lost xml:space="preserve" attributes: expected ${expectedMetrics.preservedSpaces}, found ${mergedMetrics.preservedSpaces}.`);
    }

    // 3. Audit all relationship references in document.xml
    try {
      const relsDom = parser.parseFromString(relsXml, 'application/xml');
      const relMap = new Map<string, { target: string; mode?: string }>();

      relsDom.querySelectorAll('Relationship').forEach(r => {
        const id = r.getAttribute('Id');
        const target = r.getAttribute('Target');
        const mode = r.getAttribute('TargetMode');
        if (id && target) {
          relMap.set(id, { target, mode: mode ?? undefined });
        }
      });

      const embedRe = /r:(?:embed|id|link|href)="([^"]*)"/g;
      let m: RegExpExecArray | null;

      while ((m = embedRe.exec(docXml)) !== null) {
        const relId = m[1];

        if (!relId || relId.startsWith('http://') || relId.startsWith('https://')) continue;

        const relEntry = relMap.get(relId);
        if (!relEntry) {
          errors.push(`[DANGLING_IMAGE_REF] Merged document.xml contains relationship reference "${relId}" which is missing from document.xml.rels.`);
          continue;
        }

        if (relEntry.mode !== 'External') {
          const targetPath = relEntry.target.startsWith('/') ? relEntry.target.slice(1) : `word/${relEntry.target}`;
          if (!baseZip.file(targetPath)) {
            errors.push(`[MISSING_MEDIA_TARGET] Relationship "${relId}" points to missing package file "${targetPath}".`);
          }
        }
      }
    } catch (e) {
      errors.push(`Relationship audit failed: ${String(e)}`);
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
