import { describe, expect, it } from 'vitest';
import type { InterviewConfig } from '@mianshitong/shared';
import {
  createInterviewBlueprintSkill,
  createResumeProfileSkill,
  defaultInterviewBlueprintSkill,
  defaultResumeProfileSkill,
} from './planning-skills';

const baseConfig: InterviewConfig = {
  topics: ['javascript', 'react'],
  level: 'mid',
  questionCount: 4,
  feedbackMode: 'end_summary',
};

describe('planning skills', () => {
  it('builds resume profile from source text', async () => {
    const skill = createResumeProfileSkill();
    const profile = await skill.execute({
      sourceText: '5年前端经验，负责 React 性能优化、TypeScript 工程化和 Node BFF。',
      config: baseConfig,
    });

    expect(skill.name).toBe('resume_profile');
    expect(profile.seniority).toBe('senior');
    expect(profile.yearsOfExperience).toBe(5);
    expect(profile.primaryTags.map((item) => item.tag)).toEqual(
      expect.arrayContaining(['react', 'typescript']),
    );
    expect(profile.projectTags).toContain('performance');
    expect(profile.projectTags).toContain('node');
  });

  it('builds interview blueprint from profile', async () => {
    const blueprint = await createInterviewBlueprintSkill().execute({
      profile: await defaultResumeProfileSkill.execute({
        sourceText: '3年前端经验，熟悉 React、TypeScript、工程化和性能优化。',
        config: baseConfig,
      }),
      config: baseConfig,
    });

    expect(defaultInterviewBlueprintSkill.name).toBe('interview_blueprint');
    expect(blueprint.questionCount).toBe(4);
    expect(blueprint.mustIncludeTags).toHaveLength(3);
    expect(blueprint.strategyNotes.at(-1)).toMatch(/题目方向映射为/);
  });

  it('prefers inferred profile when llm inference succeeds', async () => {
    const skill = createResumeProfileSkill({
      inferProfile: async () => ({
        seniority: 'senior',
        yearsOfExperience: 6,
        primaryTags: [
          { tag: 'React', weight: 0.96 },
          { tag: '工程化', weight: 0.82 },
        ],
        secondaryTags: [{ tag: 'TypeScript', weight: 0.61 }],
        projectTags: ['React', 'TypeScript', '工程化'],
        strengths: ['负责复杂前端架构拆分'],
        evidence: ['多次提到 React 性能优化与工程治理'],
        confidence: 0.91,
      }),
    });

    const profile = await skill.execute({
      sourceText: '2 年前端经验，做过 React 项目。',
      config: baseConfig,
    });

    expect(profile.seniority).toBe('senior');
    expect(profile.yearsOfExperience).toBe(6);
    expect(profile.primaryTags.map((item) => item.tag)).toEqual(['react', 'engineering']);
    expect(profile.secondaryTags.map((item) => item.tag)).toEqual(['typescript']);
    expect(profile.strengths).toEqual(['负责复杂前端架构拆分']);
    expect(profile.evidence[0]).toBe('多次提到 React 性能优化与工程治理');
    expect(profile.confidence).toBe(0.91);
  });

  it('falls back to rule profile when llm inference fails', async () => {
    const skill = createResumeProfileSkill({
      inferProfile: async () => {
        throw new Error('llm unavailable');
      },
    });

    const profile = await skill.execute({
      sourceText: '5年前端经验，负责 React 性能优化、TypeScript 工程化和 Node BFF。',
      config: baseConfig,
    });

    expect(profile.seniority).toBe('senior');
    expect(profile.primaryTags.map((item) => item.tag)).toEqual(
      expect.arrayContaining(['react', 'typescript']),
    );
    expect(profile.projectTags).toContain('node');
  });

  it('rethrows inference error when strict live-eval mode is enabled', async () => {
    const skill = createResumeProfileSkill({
      fallbackOnInferenceError: false,
      inferProfile: async () => {
        throw new Error('llm unavailable');
      },
    });

    await expect(
      skill.execute({
        sourceText: '5年前端经验，负责 React 性能优化、TypeScript 工程化和 Node BFF。',
        config: baseConfig,
      }),
    ).rejects.toThrow('llm unavailable');
  });
});
