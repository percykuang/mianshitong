'use client';

import { App, Button, Card, Space, Switch, Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { useRouter } from 'next/navigation';
import {
  getKnowledgeDocumentCategoryLabel,
  getKnowledgeDocumentContentShapeLabel,
  normalizeKnowledgeDocumentTags,
} from '@/components/knowledge-document-options';
import { KnowledgeDocumentRowActions } from '@/components/knowledge-document-row-actions';
import { formatDateTime } from '@/lib/format';

export interface KnowledgeDocumentRow {
  id: string;
  title: string;
  category: string;
  contentShape: string;
  tags: string[];
  chunkCount: number;
  isPublished: boolean;
  updatedAt: string;
}

interface KnowledgeDocumentsTableCardProps {
  rows: KnowledgeDocumentRow[];
}

export function KnowledgeDocumentsTableCard({ rows }: KnowledgeDocumentsTableCardProps) {
  const router = useRouter();
  const { modal, message } = App.useApp();

  const handleDelete = async (record: KnowledgeDocumentRow) => {
    const response = await fetch(
      `/api/knowledge-documents/items/${encodeURIComponent(record.id)}`,
      {
        method: 'DELETE',
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      message.error(payload?.message ?? '删除失败');
      return;
    }

    message.success('文档已删除');
    router.refresh();
  };

  const confirmDelete = (record: KnowledgeDocumentRow) => {
    modal.confirm({
      title: '确认删除该文档？',
      content: `将删除文档「${record.title}」，此操作无法撤销。`,
      okText: '确认删除',
      cancelText: '取消',
      okType: 'danger',
      onOk: () => handleDelete(record),
    });
  };

  const handleTogglePublished = async (record: KnowledgeDocumentRow, nextPublished: boolean) => {
    const response = await fetch(
      `/api/knowledge-documents/items/${encodeURIComponent(record.id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished: nextPublished }),
      },
    );
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      message.error(payload?.message ?? '发布状态更新失败');
      return;
    }

    router.refresh();
  };

  const columns: TableColumnsType<KnowledgeDocumentRow> = [
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
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (value: string) => getKnowledgeDocumentCategoryLabel(value),
    },
    {
      title: '形态',
      dataIndex: 'contentShape',
      key: 'contentShape',
      render: (value: string) => getKnowledgeDocumentContentShapeLabel(value),
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (value: string[]) => {
        const tags = normalizeKnowledgeDocumentTags(value);
        return tags.length > 0 ? (
          <Space size={[4, 4]} wrap>
            {tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        ) : (
          '-'
        );
      },
    },
    {
      title: '分块数',
      dataIndex: 'chunkCount',
      key: 'chunkCount',
      width: 96,
    },
    {
      title: '已发布',
      dataIndex: 'isPublished',
      key: 'isPublished',
      width: 96,
      render: (value: boolean, record) => (
        <Switch
          checked={value}
          onChange={(checked) => void handleTogglePublished(record, checked)}
        />
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
        <KnowledgeDocumentRowActions
          onEdit={() => {
            router.push(`/documents/${encodeURIComponent(record.id)}/edit`);
          }}
          onDelete={() => confirmDelete(record)}
        />
      ),
    },
  ];

  return (
    <Card
      title="知识文档"
      extra={
        <Space size="middle">
          <Button
            type="primary"
            onClick={() => {
              router.push('/documents/new');
            }}
          >
            新建文档
          </Button>
        </Space>
      }
    >
      <Table
        rowKey="id"
        dataSource={rows}
        columns={columns}
        pagination={false}
        style={{ marginTop: 8 }}
        locale={{ emptyText: '暂无知识文档，请先新建。' }}
      />
    </Card>
  );
}
