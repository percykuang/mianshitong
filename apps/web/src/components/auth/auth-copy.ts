export interface AuthPageCopy {
  title: string;
  description: string;
  submitLabel: string;
  passwordPlaceholder: string;
  footerText: string;
  footerLinkText: string;
  footerLinkHref: string;
}

export const AUTH_FIELD_COPY = {
  emailLabel: '邮箱',
  emailPlaceholder: '请输入邮箱地址',
  passwordLabel: '密码',
  passwordPlaceholder: '请输入密码',
} as const;

export const LOGIN_PAGE_COPY: AuthPageCopy = {
  title: '登录',
  description: '使用邮箱和密码登录面试通',
  submitLabel: '登录',
  passwordPlaceholder: AUTH_FIELD_COPY.passwordPlaceholder,
  footerText: '还没有账号？',
  footerLinkText: '立即注册',
  footerLinkHref: '/register',
};

export const REGISTER_PAGE_COPY: AuthPageCopy = {
  title: '注册',
  description: '使用邮箱和密码创建面试通账号',
  submitLabel: '注册',
  passwordPlaceholder: '请设置登录密码',
  footerText: '已经有账号？',
  footerLinkText: '立即登录',
  footerLinkHref: '/login',
};
