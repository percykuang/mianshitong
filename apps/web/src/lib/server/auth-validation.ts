import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().trim().email('请输入有效邮箱地址'),
  password: z.string().min(8, '密码至少 8 位').max(72, '密码长度不能超过 72 位'),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
