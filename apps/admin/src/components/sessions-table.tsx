'use client';

import { Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { formatDateTime } from '@/lib/format';
import { SessionRowActions } from '@/components/session-row-actions';

export interface SessionRow {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  updatedAt: string;
  userEmail: string;
}

interface SessionsTableProps {
  rows: SessionRow[];
}

export function SessionsTable({ rows }: SessionsTableProps) {
  const columns: TableColumnsType<SessionRow> = [
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
    { title: '用户', dataIndex: 'userEmail', key: 'userEmail' },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (value: string) => (
        <span className="admin-ellipsis" title={value || '未命名'}>
          {value || '未命名'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    { title: '消息数', dataIndex: 'messageCount', key: 'messageCount' },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => <SessionRowActions sessionId={record.id} title={record.title} />,
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
        locale={{ emptyText: '暂无会话。' }}
      />
    </>
  );
}
