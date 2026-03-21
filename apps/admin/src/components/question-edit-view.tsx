'use client';

import { App, Button, Card, Form, Space, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackButton } from '@/components/back-button';
import { QuestionEditorForm } from '@/components/question-editor-form';
import { normalizeQuestionTags } from '@/components/question-bank-options';

type QuestionEditInitial = {
  id: string;
  level: string;
  title: string;
  prompt: string | null;
  answer: string | null;
  keyPoints: string[];
  followUps: string[];
  tags: string[];
  order: number | null;
  isActive: boolean;
};

type QuestionFormValues = {
  level: string;
  title: string;
  prompt?: string;
  answer?: string;
  keyPointsText?: string;
  followUpsText?: string;
  tags?: string[];
  order?: number;
  isActive?: boolean;
};

function toLines(value?: string[]): string {
  return (value ?? []).join('\n');
}

function fromLines(value: string): string[] {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function QuestionEditView({ initial }: { initial: QuestionEditInitial }) {
  const headerHeight = 56;
  const footerHeight = 64;
  const router = useRouter();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    form.setFieldsValue({
      level: initial.level,
      title: initial.title,
      prompt: initial.prompt ?? '',
      answer: initial.answer ?? '',
      keyPointsText: toLines(initial.keyPoints),
      followUpsText: toLines(initial.followUps),
      tags: normalizeQuestionTags(initial.tags),
      order: initial.order ?? undefined,
      isActive: initial.isActive,
    });
  }, [form, initial]);

  const buildPayload = async () => {
    let values: QuestionFormValues;
    try {
      values = (await form.validateFields()) as QuestionFormValues;
    } catch {
      return null;
    }
    const tags = normalizeQuestionTags(values.tags);
    if (tags.length === 0) {
      message.error('请至少填写一个标签');
      return null;
    }

    return {
      level: values.level,
      title: values.title.trim(),
      prompt: values.prompt?.trim() || null,
      answer: values.answer?.trim() || null,
      keyPoints: fromLines(values.keyPointsText ?? ''),
      followUps: fromLines(values.followUpsText ?? ''),
      tags,
      order: typeof values.order === 'number' ? values.order : null,
      isActive: Boolean(values.isActive),
    };
  };

  const persistQuestion = async () => {
    if (saving) {
      return;
    }
    const payload = await buildPayload();
    if (!payload) {
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/question-bank/items/${encodeURIComponent(initial.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        message.error(result.message || '保存失败');
        return;
      }
      message.success('题目已更新');
      router.push('/questions');
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
          编辑题目
        </Typography.Title>
      </header>
      <main style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        <div style={{ padding: '16px 32px 24px' }}>
          <Card title="题目信息">
            <QuestionEditorForm form={form} />
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
          <Button type="primary" onClick={() => void persistQuestion()} loading={saving}>
            保存
          </Button>
        </Space>
      </footer>
    </div>
  );
}
