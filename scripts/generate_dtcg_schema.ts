// scripts/generate-dtcg-schema.ts
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import { mkdirSync, writeFileSync } from 'fs'; 
import { join } from 'path'; 
import { designTokenFile } from '../src/dtcg-v1.schema.js';


// ---- 2. Export schema ----
const schema = zodToJsonSchema(designTokenFile, { name: 'dtcg-v1' });

const outDir = join(process.cwd(), 'public', 'schemas'); 
mkdirSync(outDir, { recursive: true }); 
const outFile = join(outDir, 'dtcg-v1.json'); 
writeFileSync(outFile, JSON.stringify(schema, null, 2)); 
console.log(`✅ wrote ${outFile}`);