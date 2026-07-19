import { z } from 'zod'

export const classPublicationSchema = z.object({
  summary: z
    .string()
    .trim()
    .min(10, 'El resumen debe tener al menos 10 caracteres.')
    .max(5000, 'El resumen no puede superar 5000 caracteres.'),
  resources: z
    .string()
    .trim()
    .max(2000, 'Los recursos no pueden superar 2000 caracteres.')
    .transform((value) => value || null),
  questions_published: z.boolean(),
})

export type ClassPublicationValues = z.infer<typeof classPublicationSchema>
