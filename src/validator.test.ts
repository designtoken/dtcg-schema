
import { expect, describe, it } from 'vitest';
import { validateDesignTokenFile } from '../src/validator';

// ✅ Valid Design Token file (colour in object form)
const validTokenFile = {
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

// ❌ Invalid Design Token file – raw string fails our Zod colour schema
const invalidTokenFile = {
  $version: '1.0.0',
  colors: {
    primary: {
      $value: '#ff0000', // plain hex string is *not* allowed by our Zod mapping
      $type: 'color',
    },
  },
} as const;

describe('validateDesignTokenFile()', () => {
  it('accepts valid Design Token files', () => {
    expect(() => validateDesignTokenFile(validTokenFile)).not.toThrow();
  });

  it('rejects invalid Design Token files', () => {
    expect(() => validateDesignTokenFile(invalidTokenFile)).toThrow();
  });
});
