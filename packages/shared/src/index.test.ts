import { describe, expect, it } from 'vitest';
import {
  APP_SLUG,
  DEFAULT_INTERVIEW_CONFIG,
  MODEL_OPTIONS,
  normalizeInterviewConfig,
} from './index';

describe('shared constants', () => {
  it('exports app slug', () => {
    expect(APP_SLUG).toBe('mianshitong');
  });

  it('contains deepseek model options', () => {
    expect(MODEL_OPTIONS.map((item) => item.id)).toEqual(['deepseek-chat', 'deepseek-reasoner']);
  });

  it('normalizes config defaults and ranges', () => {
    const config = normalizeInterviewConfig({ questionCount: 99, topics: [] });

    expect(config.questionCount).toBe(8);
    expect(config.topics).toEqual(DEFAULT_INTERVIEW_CONFIG.topics);
  });
});
