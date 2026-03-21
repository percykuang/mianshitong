'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button, Dropdown, Layout, Menu, Typography } from 'antd';
import {
  BookOutlined,
  MessageOutlined,
  UserOutlined,
  DashboardOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
const { Sider, Content } = Layout;
const NAV_ITEMS = [
  { href: '/', label: '概览', icon: <DashboardOutlined /> },
  { href: '/users', label: '用户', icon: <UserOutlined /> },
  { href: '/sessions', label: '会话', icon: <MessageOutlined /> },
  { href: '/questions', label: '题库', icon: <BookOutlined /> },
] as const;
interface AdminShellProps {
  title: string;
  children: ReactNode;
  headerPrefix?: ReactNode;
  hideHeader?: boolean;
  contentStyle?: React.CSSProperties;
  adminUser?: {
    id: string;
    email: string;
  };
}
function resolveSelectedKey(pathname: string): string {
  const direct = NAV_ITEMS.find((item) => item.href === pathname);
  if (direct) {
    return direct.href;
  }
  const nested = NAV_ITEMS.find(
    (item) => item.href !== '/' && pathname.startsWith(`${item.href}/`),
  );
  return nested?.href ?? '/';
}
export function AdminShell({
  title,
  children,
  headerPrefix,
  hideHeader = false,
  contentStyle,
  adminUser,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  const selectedKey = hydrated ? resolveSelectedKey(pathname) : '';
  const menuItems = NAV_ITEMS.map((item) => ({
    key: item.href,
    label: <Link href={item.href}>{item.label}</Link>,
    icon: item.icon,
  }));
  const handleLogout = async () => {
    if (loggingOut) {
      return;
    }
    setLoggingOut(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      setLoggingOut(false);
      router.replace('/login');
    }
  };
  return (
    <Layout
      style={{
        minHeight: '100vh',
        height: '100vh',
        overflow: 'hidden',
        background: '#ffffff',
      }}
    >
      <Sider
        width={230}
        theme="dark"
        style={{
          background: '#0c111b',
          height: '100vh',
          position: 'sticky',
          top: 0,
          overflow: 'hidden',
          alignSelf: 'flex-start',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px 16px 12px 28px',
            color: '#f8fafc',
            fontSize: 18,
            fontWeight: 600,
          }}
        >
          面试通
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {hydrated ? (
            <Menu
              mode="inline"
              theme="dark"
              selectedKeys={selectedKey ? [selectedKey] : []}
              items={menuItems}
              style={{
                background: '#0c111b',
                color: '#cbd5e1',
                fontSize: 14,
              }}
            />
          ) : (
            <div style={{ height: 200 }} />
          )}
        </div>
        {adminUser ? (
          <div
            style={{
              borderTop: '1px solid #1f2937',
              padding: '12px 16px 16px',
              color: '#e2e8f0',
              marginTop: 'auto',
            }}
          >
            <Dropdown
              trigger={['click']}
              placement="topLeft"
              overlayClassName="admin-user-dropdown"
              menu={{
                items: [{ key: 'logout', label: '退出登录' }],
                onClick: ({ key }) => {
                  if (key === 'logout') {
                    handleLogout();
                  }
                },
              }}
            >
              <Button
                type="text"
                size="small"
                loading={loggingOut}
                className="admin-user-trigger"
                style={{ width: '100%' }}
              >
                <span className="admin-user-icon">
                  <UserOutlined style={{ fontSize: 14 }} />
                </span>
                <span className="admin-user-email">{adminUser.email}</span>
                <span className="admin-user-arrow">
                  <UpOutlined style={{ fontSize: 12, color: '#94a3b8' }} />
                </span>
              </Button>
            </Dropdown>
          </div>
        ) : (
          <div style={{ height: 12, marginTop: 'auto' }} />
        )}
      </Sider>
      <Layout style={{ background: 'transparent', overflow: 'hidden' }}>
        <Content
          className="admin-content-scroll"
          style={{
            padding: '24px 32px 24px',
            height: '100vh',
            overflow: 'auto',
            ...contentStyle,
          }}
        >
          {hideHeader ? null : (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {headerPrefix ? <div style={{ flexShrink: 0 }}>{headerPrefix}</div> : null}
                <Typography.Title level={3} style={{ marginBottom: 0 }}>
                  {title}
                </Typography.Title>
              </div>
            </div>
          )}
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
