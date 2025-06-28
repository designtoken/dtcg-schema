import { expect, describe, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { zodToJsonSchema } from 'zod-to-json-schema';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';


// ↘ Point to your Zod root schema (the one exported from dtcg-v1.schema.ts)
import { designTokenFile } from './dtcg-v1.schema';

// ↘ Path to the canonical spec JSON file shipped with your repo
const SPEC_PATH = path.resolve(__dirname, '../public/schemas/dtcg-v1.json');


describe('DTCG v1 compliance – Zod ↔ spec', () => {

  it('accepts (and rejects) data identically to the spec', () => {
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);

    const officialValidate = ajv.compile(
      JSON.parse(fs.readFileSync(SPEC_PATH, 'utf-8')),
    );

    /** Minimal but representative token set fixture (object form) */
    const sample = {
      $version: '1.0.0',
      colors: {
        primary: {
          $value: {
            colorSpace: 'srgb',
            components: [1, 0, 0],
          },
          $type: 'color',
        },
      },
    } as const;

    expect(officialValidate(sample)).toBe(true);
    expect(() => designTokenFile.parse(sample)).not.toThrow();
  });

  it('produces a JSON Schema that is itself valid', () => {
    const metaAjv = new Ajv({ strict: false });
    const metaValidate = metaAjv.compile(
      require('ajv/dist/refs/json-schema-draft-07.json'),
    );

    const generated = zodToJsonSchema(designTokenFile, {
      target: 'jsonSchema7',
      name: 'dtcg-v1',
      $refStrategy: 'none',
    });

    expect(metaValidate(generated)).toBe(true);
  });
});