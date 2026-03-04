import styles from './page.module.css';

export default function Home() {
  const cards = [
    { label: '会话总量', value: 'MVP 阶段内存态' },
    { label: '题库状态', value: '12 道初始题 + 可扩展' },
    { label: '模型接入', value: 'Mock Provider / DeepSeek 待接入' },
  ] as const;

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.header}>
          <h1>面试通后台（Admin）</h1>
          <p>用于后续管理题库、会话记录、模型配置。当前阶段先提供管理壳，确保架构可扩展。</p>
        </section>

        <section className={styles.grid}>
          {cards.map((card) => (
            <article key={card.label} className={styles.card}>
              <h2>{card.label}</h2>
              <p>{card.value}</p>
            </article>
          ))}
        </section>

        <section className={styles.roadmap}>
          <h2>下一步计划</h2>
          <ol>
            <li>接入 PostgreSQL + Prisma 持久化会话与题库。</li>
            <li>补充题库 CRUD、标签筛选、难度分级。</li>
            <li>支持 DeepSeek Provider 配置与可观测指标面板。</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
