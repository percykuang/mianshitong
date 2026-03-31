'use client';

import { EllipsisOutlined } from '@ant-design/icons';
import { Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';

interface KnowledgeDocumentRowActionsProps {
  onEdit: () => void;
  onDelete: () => void;
}

export function KnowledgeDocumentRowActions({
  onEdit,
  onDelete,
}: KnowledgeDocumentRowActionsProps) {
  const menuItems: MenuProps['items'] = [
    { key: 'edit', label: '编辑文档' },
    { type: 'divider' },
    { key: 'delete', label: '删除文档', danger: true },
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
      <Button type="text" icon={<EllipsisOutlined />} aria-label="文档操作" />
    </Dropdown>
  );
}
