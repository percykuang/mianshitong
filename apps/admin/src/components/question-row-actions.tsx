'use client';

import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { EllipsisOutlined } from '@ant-design/icons';

interface QuestionRowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
}

export function QuestionRowActions({ onEdit, onDelete }: QuestionRowActionsProps) {
  const menuItems: MenuProps['items'] = [
    { key: 'edit', label: '编辑题目' },
    { type: 'divider' },
    { key: 'delete', label: '删除题目', danger: true },
  ];

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'edit') {
      onEdit();
    }
    if (key === 'delete') {
      onDelete();
    }
  };

  return (
    <Dropdown menu={{ items: menuItems, onClick: handleMenuClick }} trigger={['hover']}>
      <Button type="text" icon={<EllipsisOutlined />} aria-label="题目操作" />
    </Dropdown>
  );
}
