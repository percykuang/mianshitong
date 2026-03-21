'use client';
import { App, Button, Card, Space, Switch, Table } from 'antd';
import type { TableColumnsType } from 'antd';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { QuestionRowActions } from '@/components/question-row-actions';
import { formatQuestionTags } from '@/components/question-bank-options';
export interface QuestionRow {
  id: string;
  level: string;
  title: string;
  tags: string[];
  order?: number | null;
  isActive: boolean;
  updatedAt: string;
}
interface QuestionsTableCardProps {
  rows: QuestionRow[];
}
export function QuestionsTableCard({ rows }: QuestionsTableCardProps) {
  const router = useRouter();
  const { modal, message } = App.useApp();
  const [selectedRowKeys, setSelectedRowKeys] = useState<Array<string>>([]);
  const handleDelete = async (record: QuestionRow) => {
    const response = await fetch(`/api/question-bank/items/${encodeURIComponent(record.id)}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      message.error(payload?.message ?? '删除失败');
      return;
    }
    message.success('题目已删除');
    router.refresh();
  };

  const confirmDelete = (record: QuestionRow) => {
    modal.confirm({
      title: '确认删除该题目？',
      content: `将删除题目「${record.title}」，此操作无法撤销。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => handleDelete(record),
    });
  };

  const handleBatchDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择题目');
      return;
    }
    modal.confirm({
      title: '确认删除所选题目？',
      content: `将删除 ${selectedRowKeys.length} 道题目，此操作无法撤销。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        const response = await fetch('/api/question-bank/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedRowKeys }),
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          message.error(payload?.message ?? '批量删除失败');
          return;
        }
        message.success('批量删除完成');
        setSelectedRowKeys([]);
        router.refresh();
      },
    });
  };

  const handleToggleActive = async (record: QuestionRow, nextActive: boolean) => {
    const response = await fetch(`/api/question-bank/items/${encodeURIComponent(record.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: nextActive }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      message.error(payload?.message ?? '状态更新失败');
      return;
    }
    router.refresh();
  };

  const columns: TableColumnsType<QuestionRow> = [
    {
      title: '序号',
      dataIndex: 'order',
      key: 'order',
      render: (value: number | null | undefined) => (typeof value === 'number' ? value : '-'),
    },
    { title: '级别', dataIndex: 'level', key: 'level' },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (value: string) => (
        <span className="admin-ellipsis" title={value}>
          {value}
        </span>
      ),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (value: string[]) => {
        const labels = formatQuestionTags(value);
        return labels.length ? labels.join(', ') : '-';
      },
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (value: boolean, record) => (
        <Switch checked={value} onChange={(checked) => void handleToggleActive(record, checked)} />
      ),
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      render: (value: string) => formatDateTime(value),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <QuestionRowActions
          onEdit={() => {
            router.push(`/questions/${encodeURIComponent(record.id)}/edit`);
          }}
          onDelete={() => confirmDelete(record)}
        />
      ),
    },
  ];

  return (
    <Card
      title="题库题目"
      extra={
        <Space size="middle">
          <Button
            type="primary"
            onClick={() => {
              router.push('/questions/new');
            }}
          >
            新建题目
          </Button>
          <Button onClick={handleBatchDelete} disabled={selectedRowKeys.length === 0} danger>
            批量删除
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        dataSource={rows}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: (keys) => setSelectedRowKeys(keys as string[]),
        }}
        pagination={false}
        style={{ marginTop: 8 }}
        locale={{ emptyText: '题库暂无题目，请先新建。' }}
      />
    </Card>
  );
}
