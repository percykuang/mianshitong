'use client';

import { Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { formatDateTime } from '@/lib/format';
import { UserRowActions } from '@/components/user-row-actions';

export interface UserRow {
  id: string;
  email: string;
  createdAt: string;
  sessionCount: number;
}

interface UsersTableProps {
  rows: UserRow[];
}

export function UsersTable({ rows }: UsersTableProps) {
  const columns: TableColumnsType<UserRow> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (value) => (
        <Typography.Text code style={{ fontSize: 12 }}>
          {value}
        </Typography.Text>
      ),
    },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '会话数量',
      dataIndex: 'sessionCount',
      key: 'sessionCount',
      render: (value: number) => <Tag>{value}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => <UserRowActions userId={record.id} email={record.email} />,
    },
  ];

  return (
    <>
      <Table
        rowKey="id"
        dataSource={rows}
        columns={columns}
        bordered
        pagination={false}
        locale={{ emptyText: '暂无用户。' }}
      />
    </>
  );
}
