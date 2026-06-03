import { z } from 'zod';

const Role = { DIETITIAN: 'DIETITIAN', OWNER: 'OWNER' };

const schema = z.object({
  role: z.preprocess(
    (val) => (typeof val === 'string' ? val.split(',') : val),
    z.array(z.nativeEnum(Role))
  ).optional()
});

console.log(schema.safeParse({ role: 'DIETITIAN,OWNER' }));
console.log(schema.safeParse({ role: 'OWNER' }));
console.log(schema.safeParse({}));
console.log(schema.safeParse({ role: 'INVALID' }));
