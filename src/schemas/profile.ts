import { z } from 'zod'

import { accountRoles } from '../types/domain'

export const accountProfileSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(accountRoles),
  display_name: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
}).strict()
