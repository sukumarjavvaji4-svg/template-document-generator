import { PipelineContext, PipelineModule, UserConstraints, GenerationResult, ValidationEntry } from './types';
import { ArchiveParser } from './modules/ArchiveParser';
import { TemplateAnalyzer } from './modules/TemplateAnalyzer';
import { ContentExtractor } from './modules/ContentExtractor';
import { ConstraintEngine } from './modules/ConstraintEngine';
import { MergePlanner } from './modules/MergePlanner';
import { MergeEngine } from './modules/MergeEngine';
import { OOXMLValidator } from './modules/OOXMLValidator';
import { PackageBuilder } from './modules/PackageBuilder';

// ─── Document Pipeline ────────────────────────────────────────────────────────
//
// 9-stage deterministic pipeline:
//   1. ArchiveParser     — Parse ZIP files into DocxArchive
//   2. TemplateAnalyzer  — Extract TemplateModel (read-only)
//   3. ContentExtractor  — Extract ContentModel[] (read-only)
//   4. ConstraintEngine  — Evaluate constraints → MergeConstraints
//   5. MergePlanner      — Plan all ID remappings → MergePlan
//   6. MergeEngine       — ONLY XML modifier → DocumentModel
//   7. OOXMLValidator    — Validate before export → ValidationReport
//   8. PackageBuilder    — Package into .docx → Blob
//
// Modules communicate via PipelineContext.
// Each module has exactly one responsibility.
// No XML modification outside of MergeEngine.

export class DocumentPipeline {
  private modules: PipelineModule[] = [
    new ArchiveParser(),
    new TemplateAnalyzer(),
    new ContentExtractor(),
    new ConstraintEngine(),
    new MergePlanner(),
    new MergeEngine(),
    new OOXMLValidator(),
    new PackageBuilder(),
  ];

  async run(ctx: PipelineContext): Promise<PipelineContext> {
    let current = ctx;
    for (const module of this.modules) {
      try {
        current = await module.execute(current);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        current.recoveryLog.push({
          code: 'MODULE_FATAL_ERROR',
          message: `[${module.name}] Fatal error: ${message}`,
          severity: 'error',
          location: module.name,
        });
        // Re-throw — the pipeline caller will handle the error display
        throw new Error(`[${module.name}] ${message}`);
      }
    }
    return current;
  }

  /** Insert a module after a named module (for future AI integration) */
  insertModule(module: PipelineModule, afterName: string): void {
    const idx = this.modules.findIndex(m => m.name === afterName);
    if (idx >= 0) {
      this.modules.splice(idx + 1, 0, module);
    } else {
      this.modules.push(module);
    }
  }

  /** Replace a named module (for testing or AI integration) */
  replaceModule(name: string, replacement: PipelineModule): void {
    const idx = this.modules.findIndex(m => m.name === name);
    if (idx >= 0) this.modules[idx] = replacement;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateDocument(
  templateFile: File,
  dataFiles: File[],
  constraints: UserConstraints,
  onProgress: (phase: string, percent: number) => void
): Promise<GenerationResult> {
  const ctx: PipelineContext = {
    templateFile,
    dataFiles,
    constraints,
    onProgress,
    recoveryLog: [],
  };

  const pipeline = new DocumentPipeline();
  const result = await pipeline.run(ctx);

  const outputBlob = result.outputBlob ?? new Blob([], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  return {
    blob: outputBlob,
    fileName: 'Final.docx',
    report: result.generationReport!,
  };
}
