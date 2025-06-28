import { z } from 'zod';

/* ───────────────────────── shared metadata ────────────────────────── */

const extensionsKeyPattern = /^[a-z0-9]+(\.[a-z0-9-]+)+$/i;
const extensionsObj = z
  .record(z.any())
  .refine(obj => Object.keys(obj).every(k => extensionsKeyPattern.test(k)), {
    message: 'extension keys must be vendor‑scoped, e.g. "com.example"',
  });

const meta = {
  $description: z.string().optional(),
  $extensions: extensionsObj.optional(),
  $deprecated: z.union([z.boolean(), z.string()]).optional(),
};

/* ───────────────────────── helpers ────────────────────────── */

// design‑token alias reference → "{group.token}" (Format §6.2)
const aliasRef = z.string().regex(/^\{[^{}]+\}$/);

// ─── reusable primitive fragments ───

// 1. Dimension (expanded unit list per Format §8.2)
const dimensionUnit = z.enum([
  'px',
  'rem',
  'em',
  'vw',
  'vh',
  'vmin',
  'vmax',
  '%',
  'pt',
  'pc',
  'cm',
  'mm',
  'in',
  'q',
  'ch',
  'ex',
  'deg',
  'rad',
  'turn',
]);
const dimensionObj = z.object({
  value: z.number(),
  unit: dimensionUnit,
});
const dimensionVal = z.union([aliasRef, dimensionObj]);

// 2. Color
const hexColor = z.string().regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
const colorComponent = z.number().min(0).max(1);
const colorObj = z.object({
  colorSpace: z.string(),
  components: z.array(colorComponent).min(3).max(4),
  alpha: z.number().min(0).max(1).optional(),
  hex: z
    .string()
    .regex(/^#?([0-9a-fA-F]{8}|[0-9a-fA-F]{6})$/)
    .optional(),
});
const colorVal = z.union([aliasRef, hexColor, colorObj]);

// 3. Font family
const fontFamilyVal = z.union([aliasRef, z.string().min(1)]);

// 4. Font weight
const weightKeyword = z.enum([
  'thin',
  'extra-light',
  'light',
  'normal',
  'medium',
  'semi-bold',
  'bold',
  'extra-bold',
  'black',
]);
const fontWeightVal = z.union([
  aliasRef,
  z.number().int().min(1).max(1000),
  weightKeyword,
]);

// 5. Duration
const durationObj = z.object({
  value: z.number().min(0),
  unit: z.enum(['ms', 's']),
});
const durationVal = z.union([aliasRef, durationObj]);

// 6. Cubic Bézier
const cubicBezierVal = z.union([aliasRef, z.array(z.number()).length(4)]);

// 7. Number
const numberVal = z.union([aliasRef, z.number()]);

/* ───────────────────────── primitive $type registry ────────────────────────── */

const baseTypes = z.enum([
  'color',
  'dimension',
  'fontFamily',
  'fontWeight',
  'duration',
  'cubicBezier',
  'number',
  'strokeStyle',
  'border',
  'transition',
  'shadow',
  'gradient',
  'typography',
]);

/* ───────────────────────── composite value schemas ────────────────────────── */

const strokeStyleVal = z.union([
  aliasRef,
  z.object({
    width: dimensionVal,
    color: colorVal,
  }),
]);

const borderVal = z.union([
  aliasRef,
  z.object({
    width: dimensionVal,
    style: z.enum(['solid', 'dashed', 'dotted']),
    color: colorVal,
  }),
]);

const transitionVal = z.union([
  aliasRef,
  z.object({
    duration: durationVal,
    timingFunction: cubicBezierVal,
    delay: durationVal.optional(),
  }),
]);

const shadowVal = z.union([
  aliasRef,
  z.object({
    offsetX: dimensionVal,
    offsetY: dimensionVal,
    blur: dimensionVal,
    spread: dimensionVal,
    color: colorVal,
  }),
]);

const gradientVal = z.union([
  aliasRef,
  z.object({
    type: z.enum(['linear', 'radial', 'conic']),
    stops: z
      .array(
        z.object({
          position: numberVal,
          color: colorVal,
        }),
      )
      .min(2),
  }),
]);

const typographyVal = z.object({
  fontFamily: fontFamilyVal,
  fontSize: dimensionVal,
  fontWeight: fontWeightVal,
  letterSpacing: dimensionVal,
  lineHeight: numberVal,
});

/* ───────────────────────── leaf‑token builder ────────────────────────── */

const leafToken = <T extends z.ZodTypeAny>(
  valueSchema: T,
  literalType: z.infer<typeof baseTypes>,
) =>
  z
    .object({
      $value: valueSchema,
      $type: z.literal(literalType).optional(), // MAY inherit
      ...meta,
    })
    .strict();

/* ───────────────────────── token variants ────────────────────────── */

const colorToken = leafToken(colorVal, 'color');
const dimensionToken = leafToken(dimensionVal, 'dimension');
const fontFamilyToken = leafToken(fontFamilyVal, 'fontFamily');
const fontWeightToken = leafToken(fontWeightVal, 'fontWeight');
const durationToken = leafToken(durationVal, 'duration');
const cubicBezierToken = leafToken(cubicBezierVal, 'cubicBezier');
const numberToken = leafToken(numberVal, 'number');
const strokeStyleToken = leafToken(strokeStyleVal, 'strokeStyle');
const borderToken = leafToken(borderVal, 'border');
const transitionToken = leafToken(transitionVal, 'transition');
const shadowToken = leafToken(shadowVal, 'shadow');
const gradientToken = leafToken(gradientVal, 'gradient');
const typographyToken = leafToken(typographyVal, 'typography');

// alias‑only token — MUST have no $type
const aliasToken = z
  .object({
    $value: aliasRef,
    ...meta,
  })
  .strict()
  .refine(o => !('$type' in o), {
    message: 'Pure alias tokens MUST NOT have a $type',
  });

export const token = z.union([
  colorToken,
  dimensionToken,
  fontFamilyToken,
  fontWeightToken,
  durationToken,
  cubicBezierToken,
  numberToken,
  strokeStyleToken,
  borderToken,
  transitionToken,
  shadowToken,
  gradientToken,
  typographyToken,
  aliasToken,
]);

/* -----------------------------------------------------------------
   Forward declaration so `group` and `tokenOrGroup` can refer
   to each other without circular‑reference errors
------------------------------------------------------------------*/
let tokenOrGroup: z.ZodTypeAny;

// ─── group schema (MAY declare $type, never $value) ───
const group = z.lazy(() =>
  z
    .object({
      $type: baseTypes.optional(),
      $description: z.string().optional(),
      $extensions: extensionsObj.optional(),
    })
    // children — placed before superRefine so .catchall lives on ZodObject
    .catchall(tokenOrGroup)
    // forbid $value inside a group
    .superRefine((obj, ctx) => {
      if ('$value' in obj) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '$value is not allowed on a group (only on tokens)',
          path: ['$value'],
        });
      }
    }),
);

tokenOrGroup = z.union([token, group]);

/* -----------------------------------------------------------------
   Top‑level Design Token file (Format v1 + Modes draft)
------------------------------------------------------------------*/

const reservedKeys = new Set([
  '$value',
  '$type',
  '$description',
  '$deprecated',
  '$extensions',
  '$version',
  '$name',
  '$modes',
]);

export const designTokenFile = z
  .object({
    $name: z.string().optional(),
    $description: z.string().optional(),
    $version: z.string().optional(),
    $extensions: extensionsObj.optional(),
    $modes: z.record(tokenOrGroup).optional(),
  })
  // all remaining keys are groups or tokens
  .catchall(tokenOrGroup)
  // custom name validation (no dot / braces / leading $)
  .superRefine((file, ctx) => {
    const badCharPattern = /[{}.]|^\$/;

    const walk = (obj: unknown, path: (string | number)[]): void => {
      if (obj && typeof obj === 'object') {
        for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
          if (!reservedKeys.has(key) && badCharPattern.test(key)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Invalid token / group name "${key}" — must not start with '$' or contain '{}' or '.'`,
              path: [...path, key],
            });
          }
          walk(value, [...path, key]);
        }
      }
    };

    walk(file, []);
  });

export type DesignTokenFile = z.infer<typeof designTokenFile>;
