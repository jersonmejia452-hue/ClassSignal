import { z } from 'zod'

export const authSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Escribe tu correo institucional.')
    .email('Escribe un correo válido.'),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres.')
    .max(72, 'La contraseña no puede superar 72 caracteres.'),
})

export type AuthFormValues = z.infer<typeof authSchema>
