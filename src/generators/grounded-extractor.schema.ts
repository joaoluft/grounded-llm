import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod.mjs';

/**
 * Wraps a developer-provided `ZodRawShape` (per research.md's field-naming
 * decision) making every field nullable — nullability is the mechanism that lets
 * the model represent "not extractable" per field (FR-206, FR-211, FR-212), distinct
 * from the developer's own notion of which fields are required domain data.
 */
export function buildExtractionSchema<Fields extends z.ZodRawShape>(fields: Fields) {
  const nullableFields = Object.fromEntries(
    Object.entries(fields).map(([key, fieldSchema]) => [
      key,
      (fieldSchema as z.ZodTypeAny).nullable(),
    ])
  ) as { [K in keyof Fields]: z.ZodNullable<Fields[K]> };

  const schema = z.object({
    ...nullableFields,
    reasoning: z.string(),
  });

  const responseFormat = zodResponseFormat(schema, 'grounded_extraction');

  return { schema, responseFormat };
}

export type ExtractionSchema<Fields extends z.ZodRawShape> = ReturnType<
  typeof buildExtractionSchema<Fields>
>['schema'];
