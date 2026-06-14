import { z } from 'zod';

import { SUPPORTED_LOCALES } from '../constants/locales';

export const localeSchema = z.enum(SUPPORTED_LOCALES);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
