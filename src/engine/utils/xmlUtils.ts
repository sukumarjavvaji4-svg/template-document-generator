import { NS } from './ooxml';

// ─── Parse / Serialize ────────────────────────────────────────────────────────

const parser = new DOMParser();
const serializer = new XMLSerializer();

export function parseXml(xmlStr: string): Document {
  const doc = parser.parseFromString(xmlStr, 'application/xml');
  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`XML parse error: ${err.textContent?.slice(0, 200)}`);
  return doc;
}

export function serializeXml(doc: Document | Element): string {
  return serializer.serializeToString(doc);
}

export function tryParseXml(xmlStr: string): Document | null {
  try {
    return parseXml(xmlStr);
  } catch {
    return null;
  }
}

// ─── Element lookup ───────────────────────────────────────────────────────────

export function findAll(root: Document | Element, ns: string, localName: string): Element[] {
  const results: Element[] = [];
  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (child.namespaceURI === ns && child.localName === localName) {
        results.push(child);
      }
      walk(child);
    }
  };
  const start = root instanceof Document ? root.documentElement : root;
  if (start.namespaceURI === ns && start.localName === localName) results.push(start);
  walk(start);
  return results;
}

export function findFirst(root: Document | Element, ns: string, localName: string): Element | null {
  return findAll(root, ns, localName)[0] ?? null;
}

export function findFirstDirect(parent: Element, ns: string, localName: string): Element | null {
  for (const child of Array.from(parent.children)) {
    if (child.namespaceURI === ns && child.localName === localName) return child;
  }
  return null;
}

// ─── Attribute helpers ────────────────────────────────────────────────────────

export function getWAttr(el: Element, name: string): string | null {
  return el.getAttributeNS(NS.w, name) ?? el.getAttribute(`w:${name}`);
}

export function setWAttr(el: Element, name: string, value: string): void {
  el.setAttributeNS(NS.w, `w:${name}`, value);
}

export function getRAttr(el: Element, name: string): string | null {
  return el.getAttributeNS(NS.r, name) ?? el.getAttribute(`r:${name}`);
}

export function setRAttr(el: Element, name: string, value: string): void {
  el.setAttributeNS(NS.r, `r:${name}`, value);
}

// ─── Node cloning ─────────────────────────────────────────────────────────────

/**
 * Deep-clone an element from one document into the context of targetDoc.
 * Uses importNode to handle cross-document adoption correctly.
 */
export function importElement(node: Element, targetDoc: Document): Element {
  return targetDoc.importNode(node, true) as Element;
}

// ─── Element creation ─────────────────────────────────────────────────────────

export function createWEl(doc: Document, localName: string): Element {
  return doc.createElementNS(NS.w, `w:${localName}`);
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _idCounter = 1;

export function generateRelId(prefix = 'rId'): string {
  return `${prefix}${String(_idCounter++).padStart(3, '0')}`;
}

export function resetIdCounter(): void {
  _idCounter = 1;
}

// ─── Numeric attribute helpers ────────────────────────────────────────────────

export function getWAttrInt(el: Element, name: string, fallback = 0): number {
  const val = getWAttr(el, name);
  if (!val) return fallback;
  const n = parseInt(val, 10);
  return isNaN(n) ? fallback : n;
}

export function halfPointToPt(hp: number): number { return hp / 2; }
export function ptToHalfPoint(pt: number): number { return pt * 2; }
export function emuToInch(emu: number): number { return emu / 914400; }
export function inchToEmu(inch: number): number { return Math.round(inch * 914400); }
export function twipToInch(twip: number): number { return twip / 1440; }
export function inchToTwip(inch: number): number { return Math.round(inch * 1440); }

// ─── Unique ID deduplication ──────────────────────────────────────────────────

export function collectAttrValues(root: Element, attrLocalName: string, attrNs: string | null = null): Set<string> {
  const result = new Set<string>();
  const walker = root.ownerDocument?.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  if (!walker) return result;
  let node: Node | null = root;
  while (node) {
    if (node instanceof Element) {
      const val = attrNs ? node.getAttributeNS(attrNs, attrLocalName) : node.getAttribute(attrLocalName);
      if (val) result.add(val);
    }
    node = walker.nextNode();
  }
  return result;
}

// ─── XML string cleanup ───────────────────────────────────────────────────────

/** Remove the XML declaration if present */
export function stripXmlDeclaration(xml: string): string {
  return xml.replace(/^<\?xml[^?]*\?>\s*/i, '');
}

/** Ensure the xml declaration is present */
export function ensureXmlDeclaration(xml: string): string {
  if (xml.startsWith('<?xml')) return xml;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`;
}
