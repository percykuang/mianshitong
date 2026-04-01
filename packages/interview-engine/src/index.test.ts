import { describe, expect, it } from 'vitest';
import type { InterviewQuestion } from '@mianshitong/shared';
import { createInterviewSession, processSessionMessage } from './index';

const questionBank: InterviewQuestion[] = [
  {
    id: 'js_event_loop',
    level: 'mid',
    title: '事件循环与任务调度',
    prompt: '请你讲一下浏览器事件循环里宏任务和微任务的执行顺序。',
    keyPoints: ['Promise', '宏任务', '微任务'],
    followUps: ['Node.js 里的 nextTick 和 Promise 微任务顺序有什么差异？'],
    tags: ['javascript', 'JavaScript'],
  },
];

describe('interview engine', () => {
  it('starts in idle status without welcome message', () => {
    const session = createInterviewSession();

    expect(session.status).toBe('idle');
    expect(session.messages.length).toBe(0);
    expect(session.runtime.questionPlan).toHaveLength(0);
    expect(session.runtime.resumeProfile).toBeNull();
  });

  it('can start and finish a single-question interview', async () => {
    const initial = createInterviewSession({
      config: {
        topics: ['javascript'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
      questionBank: [...questionBank],
    });

    const started = (
      await processSessionMessage({
        session: initial,
        content: '开始模拟面试',
        questionBank: [...questionBank],
      })
    ).session;

    expect(started.status).toBe('interviewing');
    expect(started.messages.at(-1)?.kind).toBe('question');
    expect(started.messages.at(-1)?.content).toContain('第一个问题');
    expect(started.messages.at(-1)?.content).toContain('**第一个问题：**');
    expect(started.messages.at(-1)?.content).toContain('你好，我看过你的简历了');
    expect(started.messages.at(-1)?.content).toContain('现在我们开始模拟面试吧');
    expect(started.messages.at(-1)?.content).toContain('**第一个问题：** 你先做个简短自我介绍吧。');
    expect(started.messages.at(-1)?.content).toContain(
      '**第一个问题：** 你先做个简短自我介绍吧。\n\n（重点讲讲最近几段经历的主线',
    );
    expect(started.messages.at(-1)?.content).toContain('（重点讲讲最近几段经历的主线');
    expect(started.messages.at(-1)?.content).toContain('你先做个简短自我介绍吧');
    expect(started.messages.at(-1)?.content).not.toContain('重点讲清三件事');
    expect(started.messages.at(-1)?.content).not.toContain('1.');
    expect(started.messages.at(-1)?.content).not.toContain('我当前对你的理解是');
    expect(started.messages.some((message) => message.content.includes('本场共'))).toBe(false);
    expect(started.runtime.currentStage).toBe('warmup');
    expect(started.runtime.resumeProfile?.primaryTags[0]?.tag).toBe('javascript');
    expect(started.runtime.interviewBlueprint).not.toBeNull();
    expect(started.runtime.planningTrace?.strategy).toBe('hybrid-lexical-v1');
    expect(started.runtime.planningTrace?.steps[0]?.selectedQuestionId).toBe('js_event_loop');

    const warmupFinished = (
      await processSessionMessage({
        session: started,
        content:
          '我做前端很多年，最近主要负责 JavaScript 基础和工程化相关工作，这次希望找更偏平台化的机会。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(warmupFinished.runtime.currentStage).toBe('technical');
    expect(warmupFinished.messages.at(-2)?.kind).toBe('feedback');
    expect(warmupFinished.messages.at(-2)?.content).toContain('你的基本背景我大概知道了');
    expect(warmupFinished.messages.at(-2)?.content).toContain(
      '项目名称、你负责的关键动作和结果先拎出来',
    );
    expect(warmupFinished.messages.at(-2)?.content).not.toContain('我最有代表性的项目是 X');
    expect(warmupFinished.messages.at(-1)?.kind).toBe('question');
    expect(warmupFinished.messages.at(-1)?.content).toContain('第二个问题');
    expect(warmupFinished.messages.at(-1)?.content).not.toContain('(javascript)');
    expect(warmupFinished.runtime.followUpTrace).toHaveLength(1);
    expect(warmupFinished.runtime.followUpTrace[0]?.questionId).toBe('warmup_self_intro');

    const followUpRound = (
      await processSessionMessage({
        session: warmupFinished,
        content: '我知道 Promise。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(followUpRound.runtime.followUpRound).toBe(1);
    expect(followUpRound.messages.at(-1)?.kind).toBe('follow_up');
    expect(followUpRound.messages.at(-1)?.content).toContain('点评：');
    expect(followUpRound.runtime.followUpTrace).toHaveLength(2);
    expect(followUpRound.runtime.followUpTrace[1]?.decision).toBe('ask_follow_up');
    expect(followUpRound.runtime.followUpTrace[1]?.questionId).toBe('js_event_loop');

    const finished = (
      await processSessionMessage({
        session: followUpRound,
        content:
          '调用栈清空后会先执行微任务再执行宏任务，Promise 属于微任务，最后再进入下一轮事件循环。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(finished.status).toBe('completed');
    expect(finished.report).not.toBeNull();
    expect(finished.messages.at(-1)?.kind).toBe('report');
    expect(finished.runtime.followUpTrace).toHaveLength(3);
    expect(finished.runtime.followUpTrace[2]?.decision).toBe('skip_max_round');
    expect(finished.runtime.assessmentTrace).toHaveLength(1);
    expect(finished.runtime.assessmentTrace[0]?.questionId).toBe('js_event_loop');
    expect(finished.runtime.assessmentTrace[0]?.matchedPoints).toContain('Promise');
    expect(finished.runtime.reportTrace?.level).toBe(finished.report?.level);
    expect(finished.runtime.reportTrace?.gaps.map((item) => item.point)).toEqual(
      finished.report?.gaps ?? [],
    );
  });

  it('对简历信息更完整的候选人，会在技术题后进入项目深挖阶段', async () => {
    const initial = createInterviewSession({
      config: {
        topics: ['javascript'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
      questionBank: [...questionBank],
    });

    const started = (
      await processSessionMessage({
        session: initial,
        content:
          '开始模拟面试，我有 4 年前端经验，最近主要做 monorepo、构建优化和前端工程化，负责推进 swc 替换 babel。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(started.runtime.projectQuestion?.id).toBe('project_deep_dive');

    const technicalRound = (
      await processSessionMessage({
        session: started,
        content:
          '我最近主要负责前端工程化和构建优化，最有代表性的事情是推进 swc 替换 babel，也在看新的机会。',
        questionBank: [...questionBank],
      })
    ).session;

    const projectRound = (
      await processSessionMessage({
        session: technicalRound,
        content: '调用栈清空后会先执行微任务再执行宏任务，Promise 属于微任务。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(projectRound.runtime.currentStage).toBe('project');
    expect(projectRound.messages.at(-1)?.kind).toBe('question');
    expect(projectRound.messages.at(-1)?.content).toContain('项目深挖');
    expect(projectRound.messages.at(-1)?.content).not.toContain('STAR');
  });

  it('开场回答不完整时，会先追问再进入技术题', async () => {
    const initial = createInterviewSession({
      config: {
        topics: ['javascript'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
      questionBank: [...questionBank],
    });

    const started = (
      await processSessionMessage({
        session: initial,
        content: '开始模拟面试，我有 4 年前端经验，最近主要做工程化和性能优化。',
        questionBank: [...questionBank],
      })
    ).session;

    const followUpRound = (
      await processSessionMessage({
        session: started,
        content: '我做前端很多年，也想看看新的机会。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(followUpRound.runtime.currentStage).toBe('warmup');
    expect(followUpRound.runtime.followUpRound).toBe(1);
    expect(followUpRound.messages.at(-1)?.kind).toBe('follow_up');
    expect(followUpRound.messages.at(-1)?.content).toContain('点评：');
    expect(followUpRound.messages.at(-1)?.content).toContain('主线更偏哪条');
    expect(followUpRound.messages.at(-1)?.content).not.toContain('如果只用一两句话概括');
    expect(followUpRound.runtime.followUpTrace.at(-1)?.questionId).toBe('warmup_self_intro');

    const technicalRound = (
      await processSessionMessage({
        session: followUpRound,
        content:
          '最近几段经历的主线还是前端工程化，我最能代表自己的项目是推进 swc 替换 babel，这次想找更偏平台化的机会。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(technicalRound.runtime.currentStage).toBe('technical');
    expect(technicalRound.runtime.followUpRound).toBe(0);
    expect(technicalRound.messages.at(-2)?.kind).toBe('feedback');
    expect(technicalRound.messages.at(-1)?.kind).toBe('question');
    expect(technicalRound.messages.at(-1)?.content).toContain('第二个问题');
    expect(technicalRound.messages.at(-1)?.content).not.toContain('第一个问题');
  });

  it('工程化画像会生成偏工程体系的项目深挖主问题', async () => {
    const initial = createInterviewSession({
      config: {
        topics: ['engineering'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
      questionBank: [...questionBank],
    });

    const started = (
      await processSessionMessage({
        session: initial,
        content:
          '开始模拟面试，我有 4 年前端经验，最近主要做 monorepo、构建优化、脚手架和 CI/CD，负责推进 swc 替换 babel。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(started.runtime.projectQuestion?.prompt).toContain('工程化或基础设施项目');
    expect(started.runtime.projectQuestion?.prompt).toContain('为什么当时要做');
    expect(started.runtime.projectQuestion?.prompt).toContain('怎么证明这件事做成了');
    expect(started.runtime.projectQuestion?.prompt).not.toContain('engineering');
    expect(started.runtime.projectQuestion?.prompt).not.toContain('1.');
  });

  it('加载性能画像会生成偏首屏定位与指标验证的项目深挖主问题', async () => {
    const initial = createInterviewSession({
      config: {
        topics: ['performance'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
      questionBank: [...questionBank],
    });

    const started = (
      await processSessionMessage({
        session: initial,
        content:
          '开始模拟面试，我最近主要做首屏性能优化，持续跟进 FCP、LCP、白屏和包体积指标，也做过 preload、prefetch 和缓存治理。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(started.runtime.projectQuestion?.prompt).toContain('加载性能优化项目');
    expect(started.runtime.projectQuestion?.prompt).toContain('首屏和核心指标真的改善了');
    expect(started.runtime.projectQuestion?.followUps?.[0]).toContain('FCP、LCP');
    expect(started.runtime.projectQuestion?.prompt).not.toContain('1.');
  });

  it('渲染性能画像会生成偏卡顿治理与渲染取舍的项目深挖主问题', async () => {
    const initial = createInterviewSession({
      config: {
        topics: ['performance'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
      questionBank: [...questionBank],
    });

    const started = (
      await processSessionMessage({
        session: initial,
        content:
          '开始模拟面试，我最近主要负责复杂后台页面的渲染性能治理，处理过长列表、虚拟列表、页面卡顿、FPS 掉帧和频繁重渲染问题。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(started.runtime.projectQuestion?.prompt).toContain('渲染性能优化项目');
    expect(started.runtime.projectQuestion?.prompt).toContain('交互和流畅度真的提上来了');
    expect(started.runtime.projectQuestion?.followUps?.[0]).toContain('长列表');
    expect(started.runtime.projectQuestion?.prompt).not.toContain('1.');
  });

  it('构建性能画像会生成偏构建瓶颈与兼容性收口的项目深挖主问题', async () => {
    const initial = createInterviewSession({
      config: {
        topics: ['performance'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
      questionBank: [...questionBank],
    });

    const started = (
      await processSessionMessage({
        session: initial,
        content:
          '开始模拟面试，我最近主要做构建性能优化，持续处理构建时间过长的问题，推进 Babel 迁移到 SWC，也评估过 esbuild、Rsbuild 和增量构建收益。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(started.runtime.projectQuestion?.prompt).toContain('构建性能优化项目');
    expect(started.runtime.projectQuestion?.prompt).toContain('为什么会选那套方案');
    expect(started.runtime.projectQuestion?.prompt).toContain('产物和研发体验');
    expect(started.runtime.projectQuestion?.followUps?.[0]).toContain('回滚');
    expect(started.runtime.projectQuestion?.prompt).not.toContain('1.');
  });

  it('默认业务画像会生成偏业务交付与协作的项目深挖主问题', async () => {
    const initial = createInterviewSession({
      config: {
        topics: ['react'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'per_question',
      },
      questionBank: [...questionBank],
    });

    const started = (
      await processSessionMessage({
        session: initial,
        content:
          '开始模拟面试，我最近主要负责小程序和 Web 业务迭代，做过剧场、会员、分销和广告投放等模块，也需要和产品、运营、后端一起推进项目交付。',
        questionBank: [...questionBank],
      })
    ).session;

    expect(started.runtime.projectQuestion?.prompt).toContain('业务项目');
    expect(started.runtime.projectQuestion?.prompt).toContain('业务目标是什么');
    expect(started.runtime.projectQuestion?.prompt).toContain('做出了业务结果');
    expect(started.runtime.projectQuestion?.prompt).not.toContain('1.');
  });

  it('兼容缺少 trace 数组字段的旧 runtime 会话', async () => {
    const legacySession = createInterviewSession({
      config: {
        topics: ['javascript'],
        level: 'mid',
        questionCount: 1,
        feedbackMode: 'end_summary',
      },
      questionBank: [...questionBank],
    });

    delete (legacySession.runtime as Partial<typeof legacySession.runtime>).followUpTrace;
    delete (legacySession.runtime as Partial<typeof legacySession.runtime>).assessmentTrace;
    delete (legacySession.runtime as Partial<typeof legacySession.runtime>).planningTrace;
    delete (legacySession.runtime as Partial<typeof legacySession.runtime>).reportTrace;

    const started = (
      await processSessionMessage({
        session: legacySession,
        content: '开始模拟面试',
        questionBank: [...questionBank],
      })
    ).session;

    expect(started.status).toBe('interviewing');
    expect(started.runtime.followUpTrace).toEqual([]);
    expect(started.runtime.assessmentTrace).toEqual([]);
    expect(started.runtime.planningTrace?.steps).toHaveLength(1);
  });
});
