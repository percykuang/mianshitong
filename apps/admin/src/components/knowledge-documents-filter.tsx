'use client';

import { Button, Drawer, Form, Input, Select } from 'antd';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AdminFilterActionButton } from '@/components/admin-filter-action-button';
import {
  KNOWLEDGE_DOCUMENT_CATEGORY_OPTIONS,
  normalizeKnowledgeDocumentTags,
} from '@/components/knowledge-document-options';
import { buildPageHref } from '@/lib/pagination';

const PUBLISH_STATUS_OPTIONS = [
  { label: '全部状态', value: '' },
  { label: '已发布', value: 'published' },
  { label: '未发布', value: 'draft' },
];

interface KnowledgeDocumentsFilterProps {
  title: string;
  category: string;
  status: string;
  tags: string[];
  pageSize: number;
}

interface KnowledgeDocumentsFilterFormValues {
  category?: string;
  status?: string;
  tags?: string[];
}

export function KnowledgeDocumentsFilter({
  title,
  category,
  status,
  tags,
  pageSize,
}: KnowledgeDocumentsFilterProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(title);
  const [form] = Form.useForm<KnowledgeDocumentsFilterFormValues>();

  const appliedFormValues = useMemo<KnowledgeDocumentsFilterFormValues>(
    () => ({
      category,
      status,
      tags,
    }),
    [category, status, tags],
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
          category,
          status,
          tags: tags.length > 0 ? tags.join(',') : undefined,
        }),
      );
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [category, pageSize, pathname, router, searchValue, status, tags, title]);

  const activeAdvancedFilterCount = [category, status, tags.length > 0 ? 'tags' : ''].filter(
    Boolean,
  ).length;
  const hasAnyActiveFilter =
    [title, category, status, tags.length > 0 ? 'tags' : ''].filter(Boolean).length > 0;

  const handleConfirm = async () => {
    const values = await form.validateFields();
    const nextTags = normalizeKnowledgeDocumentTags(values.tags);

    router.replace(
      buildPageHref(pathname, 1, pageSize, {
        title: searchValue.trim(),
        category: values.category?.trim(),
        status: values.status?.trim(),
        tags: nextTags.length > 0 ? nextTags.join(',') : undefined,
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
          placeholder="搜索文档标题"
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
          <Form.Item label="分类" name="category">
            <Select
              allowClear
              placeholder="按分类筛选"
              options={[...KNOWLEDGE_DOCUMENT_CATEGORY_OPTIONS]}
            />
          </Form.Item>

          <Form.Item label="状态" name="status">
            <Select allowClear placeholder="按发布状态筛选" options={[...PUBLISH_STATUS_OPTIONS]} />
          </Form.Item>

          <Form.Item label="标签" name="tags">
            <Select mode="tags" allowClear placeholder="按标签筛选" tokenSeparators={[',']} />
          </Form.Item>
        </Form>
      </Drawer>
    </>
  );
}
