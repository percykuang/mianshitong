'use client';

import { App, Button, Card, Form, Space, Typography } from 'antd';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BackButton } from '@/components/back-button';
import { KnowledgeDocumentEditorForm } from '@/components/knowledge-document-editor-form';
import { normalizeKnowledgeDocumentTags } from '@/components/knowledge-document-options';

type KnowledgeDocumentEditInitial = {
  id: string;
  title: string;
  category: string;
  contentShape: string;
  summary: string | null;
  content: string;
  tags: string[];
  isPublished: boolean;
};

type KnowledgeDocumentFormValues = {
  title: string;
  category: string;
  contentShape: string;
  summary?: string;
  content: string;
  tags?: string[];
  isPublished?: boolean;
};

export function KnowledgeDocumentEditView({ initial }: { initial: KnowledgeDocumentEditInitial }) {
  const headerHeight = 56;
  const footerHeight = 64;
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm<KnowledgeDocumentFormValues>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      title: initial.title,
      category: initial.category,
      contentShape: initial.contentShape,
      summary: initial.summary ?? '',
      content: initial.content,
      tags: normalizeKnowledgeDocumentTags(initial.tags),
      isPublished: initial.isPublished,
    });
  }, [form, initial]);

  const buildPayload = async () => {
    let values: KnowledgeDocumentFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return null;
    }

    const tags = normalizeKnowledgeDocumentTags(values.tags);
    if (tags.length === 0) {
      message.error('请至少填写一个标签');
      return null;
    }

    return {
      title: values.title.trim(),
      category: values.category,
      contentShape: values.contentShape,
      summary: values.summary?.trim() || null,
      content: values.content.trim(),
      tags,
      isPublished: Boolean(values.isPublished),
    };
  };

  const persistDocument = async () => {
    if (saving) {
      return;
    }

    const payload = await buildPayload();
    if (!payload) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/knowledge-documents/items/${encodeURIComponent(initial.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        message.error(result.message || '保存失败');
        return;
      }

      message.success('文档已更新');
      router.push('/documents');
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header
        style={{
          height: headerHeight,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 32px',
        }}
      >
        <BackButton />
        <Typography.Title level={3} style={{ margin: 0, fontSize: 20 }}>
          编辑文档
        </Typography.Title>
      </header>
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ padding: '16px 32px 24px' }}>
          <Card title="文档信息">
            <KnowledgeDocumentEditorForm form={form} />
          </Card>
        </div>
      </main>
      <footer
        style={{
          height: footerHeight,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: '1px solid #e5e7eb',
          background: '#ffffff',
          padding: '0 32px',
        }}
      >
        <Space>
          <Button type="primary" onClick={() => void persistDocument()} loading={saving}>
            保存
          </Button>
        </Space>
      </footer>
    </div>
  );
}
