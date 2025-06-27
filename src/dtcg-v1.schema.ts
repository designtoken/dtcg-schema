import { z } from 'zod';

/* ───────────────────────── helpers ────────────────────────── */

// reference “{group.token}”
const aliasRef = z.string().regex(/^\{[^{}]+\}$/);

// basic reusable pieces
const dimensionObj = z.object({
  value: z.number(),
  unit: z.enum(['px', 'rem']),                           // §8.2.1 Validation :contentReference[oaicite:0]{index=0}
});
const dimensionVal = z.union([aliasRef, dimensionObj]);

const colorComponent = z.number().min(0).max(1);
const colorObj = z.object({
  colorSpace: z.string(),
  components: z
    .array(colorComponent)
    .refine(a => a.length === 3 || a.length === 4),
  alpha: z.number().min(0).max(1).optional(),
  hex: z.string().regex(/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/).optional(),
});
const colorVal   = z.union([aliasRef, colorObj]);
const numberVal  = z.union([aliasRef, z.number()]);
const durationObj = z.object({
  value: z.number(),
  unit: z.enum(['ms', 's']),
});
const durationVal = z.union([aliasRef, durationObj]);
const cubicBezierVal = z.union([
  aliasRef,
  z.tuple([
    z.number().min(0).max(1),
    z.number(),
    z.number().min(0).max(1),
    z.number(),
  ]),
]);
const fontFamilyVal  = z.union([aliasRef, z.string(), z.array(z.string()).nonempty()]);
const fontWeightVal  = z.union([
  aliasRef,
  z.number().int().min(1).max(1000),
  z.enum([
    'thin','hairline','extra-light','ultra-light','light',
    'normal','regular','book','medium','semi-bold','demi-bold',
    'bold','extra-bold','ultra-bold','black','heavy',
    'extra-black','ultra-black',
  ]),
]);

const extensionKeyPattern = /^[a-z0-9]+(\.[a-z0-9-]+)+$/i;

const extensionsObj = z
  .record(z.any())
  .refine(
    obj => Object.keys(obj).every(k => extensionKeyPattern.test(k)),
    { message: 'extension keys must be vendor-scoped, e.g. "com.example"' },
  );

/* ───────────────────────── composite value schemas ────────────────────────── */

// §9.2 strokeStyle – string OR object                              :contentReference[oaicite:1]{index=1}
const strokeString = z.enum([
  'solid','dashed','dotted','double','groove','ridge','outset','inset',
]);
const strokeObject = z.object({
  dashArray: z.array(dimensionVal).nonempty(),
  lineCap: z.enum(['round','butt','square']),
});
const strokeStyleVal = z.union([aliasRef, strokeString, strokeObject]);

// §9.3 border                                                      :contentReference[oaicite:2]{index=2}
const borderVal = z.object({
  color: colorVal,
  width: dimensionVal,
  style: strokeStyleVal,
});

// §9.4 transition                                                  :contentReference[oaicite:3]{index=3}
const transitionVal = z.object({
  duration: durationVal,
  delay: durationVal,
  timingFunction: cubicBezierVal,
});

// §9.5 shadow                                                      :contentReference[oaicite:4]{index=4}
const singleShadow = z.object({
  color: colorVal,
  offsetX: dimensionVal,
  offsetY: dimensionVal,
  blur:    dimensionVal,
  spread:  dimensionVal,
  inset:   z.boolean().optional(),
});
const shadowVal = z.union([singleShadow, z.array(singleShadow).nonempty()]);

// §9.6 gradient                                                    :contentReference[oaicite:5]{index=5}
const gradientStop = z.object({
  color: colorVal,
  position: numberVal,      // spec clamps to [0,1]; caller may enforce if desired
});
const gradientVal = z.array(gradientStop).nonempty();

// §9.7 typography                                                  :contentReference[oaicite:6]{index=6}
const typographyVal = z.object({
  fontFamily:    fontFamilyVal,
  fontSize:      dimensionVal,
  fontWeight:    fontWeightVal,
  letterSpacing: dimensionVal,
  lineHeight:    numberVal,
});

/* ───────────────────────── shared metadata ────────────────────────── */

const meta = {
  $description: z.string().optional(),
  $extensions : extensionsObj.optional(),            // §5.2.3 Extensions :contentReference[oaicite:7]{index=7}
  $deprecated : z.union([z.boolean(), z.string()]).optional(),
};

/* ───────────────────────── token variants ────────────────────────── */

// base-type tokens
const colorToken       = z.object({ $type: z.literal('color'),       $value: colorVal,       ...meta }).strict();
const dimensionToken   = z.object({ $type: z.literal('dimension'),   $value: dimensionVal,   ...meta }).strict();
const fontFamilyToken  = z.object({ $type: z.literal('fontFamily'),  $value: fontFamilyVal,  ...meta }).strict();
const fontWeightToken  = z.object({ $type: z.literal('fontWeight'),  $value: fontWeightVal,  ...meta }).strict();
const durationToken    = z.object({ $type: z.literal('duration'),    $value: durationVal,    ...meta }).strict();
const cubicBezierToken = z.object({ $type: z.literal('cubicBezier'), $value: cubicBezierVal, ...meta }).strict();
const numberToken      = z.object({ $type: z.literal('number'),      $value: numberVal,      ...meta }).strict();

// composite-type tokens
const strokeStyleToken = z.object({ $type: z.literal('strokeStyle'), $value: strokeStyleVal, ...meta }).strict();
const borderToken      = z.object({ $type: z.literal('border'),      $value: borderVal,      ...meta }).strict();
const transitionToken  = z.object({ $type: z.literal('transition'),  $value: transitionVal,  ...meta }).strict();
const shadowToken      = z.object({ $type: z.literal('shadow'),      $value: shadowVal,      ...meta }).strict();
const gradientToken    = z.object({ $type: z.literal('gradient'),    $value: gradientVal,    ...meta }).strict();
const typographyToken  = z.object({ $type: z.literal('typography'),  $value: typographyVal,  ...meta }).strict();

// alias-only token — must have NO $type
const aliasToken = z
  .object({ $value: aliasRef, ...meta })
  .passthrough()                                           // keep unknown future $-props
  .refine(o => !('$type' in o), { message: 'Pure alias tokens MUST NOT have a $type' });

/* ───────────────────────── final export ────────────────────────── */

export const token = z.union([
  colorToken, dimensionToken, fontFamilyToken, fontWeightToken,
  durationToken, cubicBezierToken, numberToken,
  strokeStyleToken, borderToken, transitionToken,
  shadowToken, gradientToken, typographyToken,
  aliasToken,
]);

/* -----------------------------------------------------------------
     Forward declaration so `group` and `tokenOrGroup` can refer
      to each other without circular-reference errors
------------------------------------------------------------------*/
let tokenOrGroup!: z.ZodType<any>;

/* -----------------------------------------------------------------
   Group schema (recursively nest tokens or further groups)
      – only $description and $extensions are reserved; every
        other key must be a token or another group
------------------------------------------------------------------*/
const group = z.lazy(() =>
  z
    .object({
      $description: z.string().optional(),
      $extensions : extensionsObj.optional(),
    })
    .catchall(tokenOrGroup),          // everything else = token | group
);

/* -----------------------------------------------------------------
   Now that `group` exists we can define the union
------------------------------------------------------------------*/
tokenOrGroup = z.union([token, group]);



/** Top-level file schema */
export const designTokenFile = z.object({
  $description: z.string().optional(),     // §6.1.1
  $extensions : extensionsObj.optional(),  // §6.1.3
  $version    : z.string().optional(),     // *non-standard, tolerated*
}).catchall(tokenOrGroup);                 // every other key = token or group