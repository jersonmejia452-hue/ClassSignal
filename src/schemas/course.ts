import { z } from 'zod'

export const courseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres.')
    .max(100, 'El nombre no puede superar 100 caracteres.'),
  subject: z
    .string()
    .trim()
    .min(2, 'La materia debe tener al menos 2 caracteres.')
    .max(80, 'La materia no puede superar 80 caracteres.'),
  description: z
    .string()
    .trim()
    .max(500, 'La descripción no puede superar 500 caracteres.')
    .optional(),
})

export type CourseFormValues = z.infer<typeof courseSchema>
