'use client';

import { useRouter } from 'next/navigation';
import { App, Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { EllipsisOutlined } from '@ant-design/icons';

interface SessionRowActionsProps {
  sessionId: string;
  title: string;
}

export function SessionRowActions({ sessionId, title }: SessionRowActionsProps) {
  const router = useRouter();
  const { modal } = App.useApp();

  const deleteSession = async () => {
    const response = await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const errorMessage = payload?.message ?? '删除失败，请稍后重试。';
      message.error(errorMessage);
      throw new Error(errorMessage);
    }
    message.success('会话已删除');
    router.refresh();
  };

  const handleDeleteConfirm = () => {
    modal.confirm({
      title: '确认删除该会话？',
      content: `将删除会话「${title || '未命名'}」，此操作无法撤销。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => deleteSession(),
    });
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'view',
      label: '查看详情',
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除会话',
      danger: true,
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'view') {
      router.push(`/sessions/${encodeURIComponent(sessionId)}`);
      return;
    }
    if (key === 'delete') {
      handleDeleteConfirm();
    }
  };

  return (
    <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={['hover']}>
      <Button type="text" icon={<EllipsisOutlined />} aria-label="会话操作" />
    </Dropdown>
  );
}
