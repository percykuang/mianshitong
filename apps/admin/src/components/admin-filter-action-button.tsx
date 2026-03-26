'use client';

import { CloseCircleFilled, FilterOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { useState } from 'react';

interface AdminFilterActionButtonProps {
  label: string;
  hasActiveFilters: boolean;
  onOpen: () => void;
  onClear: () => void;
}

export function AdminFilterActionButton({
  label,
  hasActiveFilters,
  onOpen,
  onClear,
}: AdminFilterActionButtonProps) {
  const [hovered, setHovered] = useState(false);
  const showClearAction = hasActiveFilters && hovered;

  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Button onClick={onOpen} style={{ paddingInlineEnd: 36 }}>
        {label}
      </Button>

      {showClearAction ? (
        <button
          type="button"
          aria-label="清空所有筛选条件"
          title="清空所有筛选条件"
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
          style={{
            position: 'absolute',
            insetInlineEnd: 12,
            top: '50%',
            display: 'inline-flex',
            height: 18,
            width: 18,
            transform: 'translateY(-50%)',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            padding: 0,
            color: 'rgba(0, 0, 0, 0.45)',
            cursor: 'pointer',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.color = 'rgba(0, 0, 0, 0.88)';
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.color = 'rgba(0, 0, 0, 0.45)';
          }}
        >
          <CloseCircleFilled />
        </button>
      ) : (
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInlineEnd: 12,
            top: '50%',
            display: 'inline-flex',
            height: 18,
            width: 18,
            transform: 'translateY(-50%)',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(0, 0, 0, 0.45)',
            pointerEvents: 'none',
            transition: 'color 0.2s ease',
          }}
        >
          <FilterOutlined />
        </span>
      )}
    </div>
  );
}
