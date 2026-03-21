'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { App, Button, Dropdown, message } from 'antd';
import type { MenuProps } from 'antd';
import { EllipsisOutlined } from '@ant-design/icons';

interface UserRowActionsProps {
  userId: string;
  email: string;
}

export function UserRowActions({ userId, email }: UserRowActionsProps) {
  const router = useRouter();
  const { modal } = App.useApp();

  const deleteUser = async () => {
    const response = await fetch(`/api/users/${userId}`, { method: 'DELETE' });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      const errorMessage = payload?.message ?? '删除失败，请稍后重试。';
      message.error(errorMessage);
      throw new Error(errorMessage);
    }
    message.success('用户已删除');
    router.refresh();
  };

  const handleDeleteConfirm = () => {
    modal.confirm({
      title: '确认删除该用户？',
      content: `将删除用户 ${email} 及其所有会话记录，此操作无法撤销。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => deleteUser(),
    });
  };

  const menuItems: MenuProps['items'] = [
    {
      key: 'view',
      label: <Link href={`/sessions?userId=${userId}`}>查看会话</Link>,
    },
    { type: 'divider' },
    {
      key: 'delete',
      label: '删除用户',
      danger: true,
    },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'delete') {
      handleDeleteConfirm();
    }
  };

  return (
    <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={['hover']}>
      <Button type="text" icon={<EllipsisOutlined />} aria-label="更多操作" />
    </Dropdown>
  );
}
