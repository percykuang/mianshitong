import Link from 'next/link';
import { ArrowRight, CircleCheck, Code2, FileText, MessageSquare, Sparkles } from 'lucide-react';
import { GuestMenu } from '@/components/guest-menu';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

const highlights = ['专注前端开发领域', '基于最新技术栈', 'AI 智能分析', '即时反馈建议'] as const;

const features = [
  {
    title: '简历优化',
    description: '专业的简历分析和优化建议，帮你打造脱颖而出的简历',
    icon: FileText,
  },
  {
    title: '模拟面试',
    description: '真实的面试场景模拟，提供即时反馈和改进建议',
    icon: MessageSquare,
  },
  {
    title: '面试题解答',
    description: '涵盖前端、算法、系统设计等各类编程面试题详解',
    icon: Code2,
  },
] as const;

const demos = [
  {
    title: '简历智能分析',
    description: '上传简历，AI 自动分析并提供优化建议',
  },
  {
    title: '模拟面试场景',
    description: '真实面试对话，实时反馈和评分',
  },
  {
    title: '面试题详解',
    description: '前端经典面试题目，详细解答和思路分析',
  },
] as const;

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold text-blue-600">面试通</span>
          </div>
          <GuestMenu menuPlacement="down" />
        </div>
      </header>

      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-4xl space-y-6 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-accent px-3 py-1 text-sm text-accent-foreground">
            <Sparkles className="size-4" />
            <span>由 AI 驱动的智能面试助手</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-balance md:text-6xl">
            你的专属<span className="text-blue-600"> AI Agent</span> 面试官
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-balance text-muted-foreground md:text-xl">
            专注编程领域，尤其前端开发。提供简历优化、模拟面试、面试题解答等全方位面试辅导服务
          </p>
          <div className="flex flex-col items-center justify-center gap-4 pt-4 sm:flex-row">
            <Button
              asChild
              className="h-11 w-fit! shrink-0 cursor-pointer rounded-md bg-blue-600 px-8! text-white hover:bg-blue-700 has-[>svg]:px-8!"
            >
              <Link href="/chat">
                立即开始
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-8 md:gap-6">
            {highlights.map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CircleCheck className="size-4 text-primary" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="features" className="container mx-auto px-4 py-16 md:py-24">
        <div className="mb-12 space-y-4 text-center">
          <h2 className="text-3xl font-bold text-balance md:text-4xl">核心功能</h2>
          <p className="mx-auto max-w-2xl text-lg text-balance text-muted-foreground">
            全方位的面试准备解决方案
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {features.map((item) => {
            const Icon = item.icon;
            return (
              <Card
                key={item.title}
                className="space-y-4 rounded-lg border p-6 shadow-sm transition-colors hover:border-primary"
              >
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="size-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-16 md:py-24">
        <div className="container mx-auto">
          <div className="mb-12 space-y-4 text-center">
            <h2 className="text-3xl font-bold text-balance md:text-4xl">功能演示</h2>
            <p className="mx-auto max-w-2xl text-lg text-balance text-muted-foreground">
              看看 AI 面试官如何帮助你准备面试
            </p>
          </div>
          <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-3">
            {demos.map((item) => (
              <Card key={item.title} className="overflow-hidden rounded-lg border-2 shadow-sm">
                <div className="flex aspect-video items-center justify-center bg-muted" />
                <div className="space-y-2 p-6">
                  <h3 className="text-2xl font-semibold">{item.title}</h3>
                  <p className="leading-relaxed text-muted-foreground">{item.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto flex max-w-4xl flex-col space-y-6 rounded-lg border-0 bg-primary p-8 text-center text-primary-foreground shadow-sm md:p-12">
          <h2 className="text-3xl font-bold text-balance md:text-4xl">
            准备好开始你的面试准备了吗？
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-balance text-primary-foreground/90">
            立即与 AI 面试官对话，获取专业的面试指导和建议
          </p>
          <div className="flex pt-4">
            <Button
              asChild
              variant="secondary"
              className="h-11 w-fit! flex-1 shrink-0 rounded-md px-8 text-secondary-foreground"
            >
              <Link href="/chat">
                开始对话
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded bg-primary">
                <Sparkles className="size-4 text-primary-foreground" />
              </div>
              <span className="text-sm text-muted-foreground">© 2026 面试通</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
