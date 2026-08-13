import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

(global as any).DOMParser = DOMParser;
(global as any).XMLSerializer = XMLSerializer;

import { DocxArchive } from '../src/engine/types';
import { TemplateAnalyzer } from '../src/engine/modules/TemplateAnalyzer';
import { ContentExtractor } from '../src/engine/modules/ContentExtractor';
import { MergePlanner } from '../src/engine/modules/MergePlanner';
import { MergeEngine } from '../src/engine/modules/MergeEngine';
import { PackageBuilder } from '../src/engine/modules/PackageBuilder';
import { OOXMLValidator } from '../src/engine/modules/OOXMLValidator';
import { ArchiveParser } from '../src/engine/modules/ArchiveParser';

async function generateTestDoc() {
  const sourcePath = 'C:\\Users\\sukum\\OneDrive\\Documents\\SKILL_MENTOR_SRS.docx';
  const templatePath = 'C:\\Users\\sukum\\Downloads\\2-sidedTemplate (1).docx';

  console.log('Loading template & data doc...');
  const templateBuf = fs.readFileSync(templatePath);
  const dataBuf = fs.readFileSync(sourcePath);

  const templateFile = new File([templateBuf], '2-sidedTemplate (1).docx');
  const dataFile = new File([dataBuf], 'SKILL_MENTOR_SRS.docx');

  const parser = new ArchiveParser();
  const templateArc: DocxArchive = await parser.parseFile(templateFile);
  const dataArc: DocxArchive = await parser.parseFile(dataFile);

  const templateAnalyzer = new TemplateAnalyzer();
  const templateModel = templateAnalyzer.analyze(templateArc);

  const extractor = new ContentExtractor();
  const contentModel = extractor.extract(dataArc, 'SKILL_MENTOR_SRS.docx', 0);

  const mergePlanner = new MergePlanner();
  const mergeConstraints = {
    userConstraints: {
      insertSectionBreakBetweenDocs: false,
      applyTemplateHeaderFooterToAllDocs: true,
      sectionBreakType: 'nextPage',
    },
    conflicts: [],
    logs: [],
  };

  const mergePlan = mergePlanner.plan(templateModel, [contentModel], mergeConstraints as any, []);

  const mergeEngine = new MergeEngine();
  const documentModel = mergeEngine.merge(templateModel, mergePlan);

  const validator = new OOXMLValidator();
  const validationReport = validator.validate(documentModel);
  console.log('Validation report passed:', validationReport.valid);
  if (!validationReport.valid) {
    console.log('Validation errors:', validationReport.entries.filter(e => e.severity === 'error'));
  }

  const builder = new PackageBuilder();
  const { blob } = await builder.buildPackage(documentModel, templateArc, templateModel);

  const arrayBuf = await blob.arrayBuffer();
  const outPath = path.resolve('scratch/Generated_Test.docx');
  fs.writeFileSync(outPath, Buffer.from(arrayBuf));
  console.log('Successfully written test generated docx to:', outPath);
}

generateTestDoc().catch(console.error);
