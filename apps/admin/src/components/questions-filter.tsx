'use client';

import { Button, Drawer, Form, Input, Select } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminFilterActionButton } from '@/components/admin-filter-action-button';
import { buildPageHref } from '@/lib/pagination';
import {
  QUESTION_LEVEL_OPTIONS,
  QUESTION_TAG_OPTIONS,
  normalizeQuestionTags,
} from '@/components/question-bank-options';

const STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '启用', value: 'active' },
  { label: '停用', value: 'inactive' },
];

interface QuestionsFilterProps {
  title: string;
  tags: string[];
  level: string;
  status: string;
  pageSize: number;
}

interface QuestionsFilterFormValues {
  tags?: string[];
  level?: string;
  status?: string;
}

export function QuestionsFilter({ title, tags, level, status, pageSize }: QuestionsFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(title);
  const [form] = Form.useForm<QuestionsFilterFormValues>();

  const appliedFormValues = useMemo<QuestionsFilterFormValues>(
    () => ({
      tags,
      level,
      status,
    }),
    [level, status, tags],
  );

  useEffect(() => {
    setSearchValue(title);
  }, [title]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    form.setFieldsValue(appliedFormValues);
  }, [appliedFormValues, drawerOpen, form]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const trimmedTitle = searchValue.trim();
      if (trimmedTitle === title) {
        return;
      }

      router.replace(
        buildPageHref(pathname, 1, pageSize, {
          title: trimmedTitle,
          tags: tags.length > 0 ? tags.join(',') : undefined,
          level,
          status,
        }),
      );
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [level, pageSize, pathname, router, searchValue, status, tags, title]);

  const activeAdvancedFilterCount = [tags.length > 0 ? 'tags' : '', level, status].filter(
    Boolean,
  ).length;
  const hasAnyActiveFilter =
    [title, tags.length > 0 ? 'tags' : '', level, status].filter(Boolean).length > 0;

  const handleConfirm = async () => {
    const values = await form.validateFields();
    const nextTags = normalizeQuestionTags(values.tags);

    router.replace(
      buildPageHref(pathname, 1, pageSize, {
        title: searchValue.trim(),
        tags: nextTags.length > 0 ? nextTags.join(',') : undefined,
        level: values.level?.trim(),
        status: values.status?.trim(),
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
    router.replace(buildPageHref(pathname, 1, pageSize, {}));
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
          placeholder="搜索题目标题"
          onChange={(event) => setSearchValue(event.target.value)}
          style={{ width: 260 }}
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
          <Form.Item label="标签" name="tags">
            <Select
              mode="tags"
              allowClear
              placeholder="按标签筛选"
              options={QUESTION_TAG_OPTIONS}
              optionFilterProp="label"
              tokenSeparators={[',']}
            />
          </Form.Item>

          <Form.Item label="难度" name="level">
            <Select allowClear placeholder="按难度筛选" options={QUESTION_LEVEL_OPTIONS} />
          </Form.Item>

          <Form.Item label="状态" name="status">
            <Select allowClear placeholder="按状态筛选" options={STATUS_OPTIONS} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
