import { z } from 'zod'

export const studentAuthSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe tu correo.')
    .max(254, 'El correo no puede superar 254 caracteres.')
    .email('Escribe un correo válido.'),
})

export type StudentAuthValues = z.infer<typeof studentAuthSchema>
