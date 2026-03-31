'use client';

import { Button, Drawer, Form, Input, Select } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminFilterActionButton } from '@/components/admin-filter-action-button';
import { buildPageHref } from '@/lib/pagination';
import {
  KNOWLEDGE_TRACE_INTENT_VALUES,
  KNOWLEDGE_TRACE_MODE_VALUES,
  type KnowledgeTraceIntentKind,
  type KnowledgeTraceMode,
} from '@/lib/knowledge-trace';

interface KnowledgeTraceFilterProps {
  days: number;
  keyword: string;
  intentKind: KnowledgeTraceIntentKind | '';
  mode: KnowledgeTraceMode | '';
  pageSize: number;
}

interface KnowledgeTraceFilterFormValues {
  days?: number;
  intentKind?: KnowledgeTraceIntentKind | '';
  mode?: KnowledgeTraceMode | '';
}

const DAY_OPTIONS = [7, 14, 30, 90].map((value) => ({
  label: `最近 ${value} 天`,
  value,
}));

const INTENT_LABELS: Record<KnowledgeTraceIntentKind, string> = {
  technical_question: '技术问答',
  interview_playbook: '面试打法',
  project_highlight: '项目亮点',
  resume_optimize: '简历优化',
  self_intro: '自我介绍',
};

const MODE_LABELS: Record<KnowledgeTraceMode, string> = {
  strong: '强命中',
  weak: '弱命中',
  none: '未命中',
};

export function KnowledgeTraceFilter({
  days,
  keyword,
  intentKind,
  mode,
  pageSize,
}: KnowledgeTraceFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(keyword);
  const [form] = Form.useForm<KnowledgeTraceFilterFormValues>();

  const appliedFormValues = useMemo<KnowledgeTraceFilterFormValues>(
    () => ({
      days,
      intentKind,
      mode,
    }),
    [days, intentKind, mode],
  );

  useEffect(() => {
    setSearchValue(keyword);
  }, [keyword]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    form.setFieldsValue(appliedFormValues);
  }, [appliedFormValues, drawerOpen, form]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmedKeyword = searchValue.trim();
      if (trimmedKeyword === keyword) {
        return;
      }

      router.replace(
        buildPageHref(pathname, 1, pageSize, {
          keyword: trimmedKeyword,
          days,
          intent: intentKind,
          mode,
        }),
      );
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [days, intentKind, keyword, mode, pageSize, pathname, router, searchValue]);

  const activeAdvancedFilterCount = [days !== 14 ? 'days' : '', intentKind, mode].filter(
    Boolean,
  ).length;
  const hasAnyActiveFilter =
    [keyword, days !== 14 ? 'days' : '', intentKind, mode].filter(Boolean).length > 0;

  const handleConfirm = async () => {
    const values = await form.validateFields();
    router.replace(
      buildPageHref(pathname, 1, pageSize, {
        keyword: searchValue.trim(),
        days: values.days ?? 14,
        intent: values.intentKind,
        mode: values.mode,
      }),
    );
    setDrawerOpen(false);
  };

  const handleCancel = () => {
    form.setFieldsValue(appliedFormValues);
    setDrawerOpen(false);
  };

  const handleClearAll = () => {
    setSearchValue('');
    setDrawerOpen(false);
    router.replace(buildPageHref(pathname, 1, pageSize, { days: 14 }));
  };

  return (
    <>
      <div
        style={{
          marginBottom: 16,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
        }}
      >
        <Input
          allowClear
          value={searchValue}
          placeholder="搜索 Query、文档标题或会话标题"
          onChange={(event) => setSearchValue(event.target.value)}
          style={{ width: 320 }}
        />
        <AdminFilterActionButton
          label={activeAdvancedFilterCount > 0 ? `筛选（${activeAdvancedFilterCount}）` : '筛选'}
          hasActiveFilters={hasAnyActiveFilter}
          onOpen={() => setDrawerOpen(true)}
          onClear={handleClearAll}
        />
      </div>

      <Drawer
        title="筛选"
        placement="right"
        width={420}
        open={drawerOpen}
        onClose={handleCancel}
        closeIcon={false}
        destroyOnHidden={false}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
            <Button onClick={handleCancel}>取消</Button>
            <Button type="primary" onClick={() => void handleConfirm()}>
              确定
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical" initialValues={appliedFormValues}>
          <Form.Item label="时间范围" name="days">
            <Select options={DAY_OPTIONS} placeholder="选择时间范围" allowClear={false} />
          </Form.Item>

          <Form.Item label="意图" name="intentKind">
            <Select
              allowClear
              placeholder="按意图筛选"
              options={KNOWLEDGE_TRACE_INTENT_VALUES.map((value) => ({
                label: INTENT_LABELS[value],
                value,
              }))}
            />
          </Form.Item>

          <Form.Item label="命中模式" name="mode">
            <Select
              allowClear
              placeholder="按命中模式筛选"
              options={KNOWLEDGE_TRACE_MODE_VALUES.map((value) => ({
                label: MODE_LABELS[value],
                value,
              }))}
            />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
