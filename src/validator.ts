
import { designTokenFile, DesignTokenFile } from './dtcg-v1.schema';
import { ZodError } from 'zod';

/**
 * Validates a raw Design Token JSON object against the "designTokenFile"
 * schema. Throws a detailed ZodError on failure.
 *
 * @param data – parsed JSON "Design Token File" (any JS value)
 * @returns The same object, but now typed as DesignTokenFile
 * @throws ZodError – if validation fails
 */
export function validateDesignTokenFile(data: unknown): DesignTokenFile {
  try {
    return designTokenFile.parse(data);
  } catch (err) {
    if (err instanceof ZodError) {
      // re‑throw with a friendlier message while preserving Zod issues
      throw new ZodError(err.issues);
    }
    throw err;
  }
}
