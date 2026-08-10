import JSZip from 'jszip';
import { DocxArchive, PipelineContext, PipelineModule, RelEntry } from '../types';

export class ArchiveParser implements PipelineModule {
  readonly name = 'ArchiveParser';

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    ctx.onProgress('Parsing archives', 3);
    ctx.templateArchive = await this.parseFile(ctx.templateFile);
    ctx.dataArchives = [];
    for (const f of ctx.dataFiles) {
      ctx.dataArchives.push(await this.parseFile(f));
    }
    ctx.onProgress('Archives parsed', 8);
    return ctx;
  }

  async parseFile(file: File): Promise<DocxArchive> {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);

    const xmlParts = new Map<string, Document>();
    const rawXmlParts = new Map<string, string>();
    const mediaParts = new Map<string, Uint8Array>();
    const relMaps = new Map<string, RelEntry[]>();

    const tasks: Promise<void>[] = [];
    zip.forEach((path, entry) => {
      if (entry.dir) return;
      const lp = path.toLowerCase();

      if (lp.startsWith('word/media/') || lp.startsWith('xl/media/') || lp.startsWith('ppt/media/')) {
        tasks.push(entry.async('uint8array').then(d => { mediaParts.set(path, d); }));
      } else if (lp.endsWith('.xml') || lp.endsWith('.rels')) {
        tasks.push(entry.async('string').then(text => {
          if (lp.endsWith('.rels')) {
            const rels = this._parseRels(text);
            const parent = this._relsToPartPath(path);
            relMaps.set(parent, rels);
          } else {
            rawXmlParts.set(path, text);
            try {
              xmlParts.set(path, new DOMParser().parseFromString(text, 'application/xml'));
            } catch { /* skip corrupt XML */ }
          }
        }));
      }
    });

    await Promise.all(tasks);
    return { zip, xmlParts, rawXmlParts, mediaParts, relMaps };
  }

  private _parseRels(text: string): RelEntry[] {
    const rels: RelEntry[] = [];
    const ns = 'http://schemas.openxmlformats.org/package/2006/relationships';
    try {
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      for (const el of Array.from(doc.getElementsByTagNameNS(ns, 'Relationship'))) {
        rels.push({
          id: el.getAttribute('Id') ?? '',
          type: el.getAttribute('Type') ?? '',
          target: el.getAttribute('Target') ?? '',
          targetMode: (el.getAttribute('TargetMode') as 'External' | 'Internal') ?? 'Internal',
        });
      }
    } catch { /* skip */ }
    return rels;
  }

  private _relsToPartPath(relsPath: string): string {
    // word/_rels/document.xml.rels → word/document.xml
    // _rels/.rels → '' (root)
    const parts = relsPath.split('/');
    const relsIdx = parts.lastIndexOf('_rels');
    if (relsIdx < 0) return '';
    const fileName = parts[parts.length - 1].replace(/\.rels$/, '');
    const parentParts = parts.slice(0, relsIdx);
    if (!fileName || fileName === '.') return parentParts.join('/');
    return [...parentParts, fileName].join('/');
  }

  /** Resolve a rel target relative to the part's directory */
  static resolveTarget(partPath: string, relTarget: string): string {
    if (relTarget.startsWith('/')) return relTarget.slice(1);
    if (relTarget.startsWith('http') || relTarget.startsWith('mailto:')) return relTarget;
    const dir = partPath.includes('/')
      ? partPath.substring(0, partPath.lastIndexOf('/') + 1)
      : '';
    return (dir + relTarget).replace(/\/\.\//g, '/');
  }

  static getRels(archive: DocxArchive, partPath: string): RelEntry[] {
    return archive.relMaps.get(partPath) ?? [];
  }
}
