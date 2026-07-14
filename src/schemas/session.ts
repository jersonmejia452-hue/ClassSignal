import { z } from 'zod'

export const sessionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'El título debe tener al menos 3 caracteres.')
    .max(100, 'El título no puede superar 100 caracteres.'),
  subject: z
    .string()
    .trim()
    .min(2, 'La materia debe tener al menos 2 caracteres.')
    .max(80, 'La materia no puede superar 80 caracteres.'),
  topic: z
    .string()
    .trim()
    .min(2, 'El tema debe tener al menos 2 caracteres.')
    .max(120, 'El tema no puede superar 120 caracteres.'),
  courseId: z
    .string()
    .uuid('Selecciona un curso válido.')
    .nullable()
    .optional(),
})

export type SessionFormValues = z.infer<typeof sessionSchema>
