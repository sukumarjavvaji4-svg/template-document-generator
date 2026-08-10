import {
  PipelineContext, PipelineModule, MergeConstraints, UserConstraints,
  PageEstimate, ConstraintConflict, ContentModel, TemplateModel,
} from '../types';

// ─── Constraint Engine ────────────────────────────────────────────────────────
// Stage 4: Evaluates user constraints against the template and content models.
// Produces MergeConstraints — a validated, enriched version of the user input.
// NO XML generation. NO XML modification. Pure evaluation.

export class ConstraintEngine implements PipelineModule {
  readonly name = 'ConstraintEngine';

  async execute(ctx: PipelineContext): Promise<PipelineContext> {
    ctx.onProgress('Applying constraints', 34);
    ctx.mergeConstraints = this.evaluate(
      ctx.templateModel!,
      ctx.contentModels!,
      ctx.constraints
    );
    ctx.onProgress('Constraints evaluated', 42);
    return ctx;
  }

  evaluate(
    templateModel: TemplateModel,
    contentModels: ContentModel[],
    userConstraints: UserConstraints
  ): MergeConstraints {
    const conflicts: ConstraintConflict[] = [];

    // ── Estimate total pages (advisory only) ─────────────────────────────
    const totalNodes = contentModels.reduce((s, m) => s + m.nodes.length, 0);
    // Very rough heuristic: ~40 paragraphs/tables per page
    const estimatedPages = Math.max(1, Math.ceil(totalNodes / 40));
    const pageEstimate: PageEstimate = {
      estimatedPages,
      disclaimer: 'Advisory estimate only. Final pagination is determined by Microsoft Word.',
    };

    // ── Validate page limit ───────────────────────────────────────────────
    if (userConstraints.pageLimitEnabled) {
      if (userConstraints.maxPages < 1) {
        conflicts.push({
          code: 'INVALID_PAGE_LIMIT',
          message: 'Page limit must be at least 1.',
          severity: 'error',
        });
      }
      if (estimatedPages > userConstraints.maxPages) {
        conflicts.push({
          code: 'PAGE_LIMIT_MAY_EXCEED',
          message: `Estimated ${estimatedPages} pages exceeds limit of ${userConstraints.maxPages}. Compression strategies will be applied.`,
          severity: 'warning',
        });
      }
    }

    // ── Validate font size constraints ────────────────────────────────────
    if (userConstraints.minFontSizePt >= userConstraints.maxFontSizePt) {
      conflicts.push({
        code: 'INVALID_FONT_RANGE',
        message: `Min font size (${userConstraints.minFontSizePt}pt) must be less than max (${userConstraints.maxFontSizePt}pt).`,
        severity: 'warning',
      });
    }

    // ── Validate image scale ──────────────────────────────────────────────
    if (userConstraints.minImageScalePercent < 10 || userConstraints.minImageScalePercent > 100) {
      conflicts.push({
        code: 'INVALID_IMAGE_SCALE',
        message: `Min image scale (${userConstraints.minImageScalePercent}%) should be between 10-100%.`,
        severity: 'warning',
      });
    }

    // ── Validate constraint strategies order ──────────────────────────────
    if (userConstraints.pageLimitEnabled && userConstraints.constraintStrategies.length === 0) {
      conflicts.push({
        code: 'NO_STRATEGIES',
        message: 'Page limit is enabled but no constraint strategies are configured.',
        severity: 'warning',
      });
    }

    // ── Check for empty data documents ────────────────────────────────────
    for (const model of contentModels) {
      if (model.nodes.length === 0) {
        conflicts.push({
          code: 'EMPTY_DATA_DOC',
          message: `Data document "${model.sourceFileName}" contains no extractable body content.`,
          severity: 'warning',
        });
      }
    }

    return { userConstraints, pageEstimate, conflicts };
  }
}
