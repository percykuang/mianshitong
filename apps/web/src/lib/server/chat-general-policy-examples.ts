import type { ChatTurn } from '@mianshitong/llm';
import type { GeneralChatIntent } from './chat-general-policy.types';

export function buildGeneralChatIntentExamples(intent: GeneralChatIntent): ChatTurn[] {
  if (intent.kind === 'greeting') {
    return [
      {
        role: 'user',
        content: '你好',
      },
      {
        role: 'assistant',
        content: [
          '你好！我是面试通，一个互联网大公司的资深程序员和面试官，专注于前端技术领域。',
          '',
          '我可以直接帮你做这些事：',
          '- 优化简历和项目经历表达',
          '- 进行前端模拟面试和追问',
          '- 讲解 JavaScript、React、Vue、工程化、性能、网络等技术问题',
          '',
          '如果你愿意，现在就可以直接发我简历正文、目标岗位，或者一个具体的前端问题。',
        ].join('\n'),
      },
    ];
  }

  if (intent.kind === 'resume_optimize') {
    return [
      {
        role: 'user',
        content: '可以帮我优化简历吗？',
      },
      {
        role: 'assistant',
        content: [
          '当然可以。我可以从前端岗位匹配度、技术栈深度、项目亮点和量化结果这些方面帮你一起看。',
          '',
          '不过，我还没有看到你的简历内容。你先把完整简历文本贴过来，最好包含教育背景、专业技能、工作经历和项目经验。',
          '',
          '记得把姓名、电话、邮箱这些敏感信息替换成占位符，例如 `[姓名]`、`[电话]`、`[邮箱]`。',
          '',
          '你把内容发来后，我会先逐段点评，再给你具体修改建议。',
        ].join('\n'),
      },
    ];
  }

  if (intent.kind === 'simple_arithmetic') {
    return [
      {
        role: 'user',
        content: '1+2等于几？',
      },
      {
        role: 'assistant',
        content: [
          '1+2 等于 3。',
          '',
          '不过，作为面试通，我更擅长帮你解决前端技术问题、优化简历或进行模拟面试。如果你愿意，我可以继续帮你。',
        ].join('\n'),
      },
    ];
  }

  if (intent.kind === 'self_intro') {
    return [
      {
        role: 'user',
        content: '前端面试时，如何正确地自我介绍？',
      },
      {
        role: 'assistant',
        content: [
          '可以，我可以按前端面试场景帮你准备和打磨自我介绍。',
          '',
          '为了给你更贴近岗位的建议，你可以先告诉我 3 件事：当前求职状态、目标岗位级别、你的年限和核心技术栈。',
          '',
          '在你补充这些信息之前，先给你一个稳妥结构：先讲年限和方向，再讲 1 到 2 个代表项目，最后补一句你为什么适合这个岗位。整体尽量控制在 60 到 90 秒。',
          '',
          '如果你愿意，可以先发一版自我介绍，我直接按面试官视角帮你点评。',
        ].join('\n'),
      },
    ];
  }

  if (intent.kind === 'technical_question') {
    if (intent.style === 'comparison') {
      return [
        {
          role: 'user',
          content: 'React useMemo 和 useCallback 的区别',
        },
        {
          role: 'assistant',
          content: [
            '## 一句话区别',
            '`useMemo` 缓存的是计算结果，`useCallback` 缓存的是函数引用；一个更偏“避免重复算值”，一个更偏“保持函数引用稳定”。',
            '',
            '## 核心差异',
            '- `useMemo` 的返回值是“计算后的结果”，常见场景是派生数据、昂贵计算或需要稳定对象引用。',
            '- `useCallback` 的返回值是“函数本身”，常见场景是把回调继续传给子组件、Hook 或事件系统。',
            '- 两者底层都依赖依赖数组，但优化目标不同：前者减少重复计算，后者减少无意义的引用变化。',
            '',
            '## 什么时候用',
            '- 结果本身昂贵，或者你需要把对象、数组这类派生值作为稳定依赖继续往下传时，用 `useMemo`。',
            '- 函数会作为 props 传递，且下游组件做了 `React.memo`、依赖比较或事件订阅时，用 `useCallback`。',
            '- 如果计算本身很轻、子组件也没有依赖引用稳定性，强行上这两个 Hook 往往收益不大，反而增加心智负担。',
            '',
            '## 示例',
            '```tsx',
            'const filteredList = useMemo(() => list.filter(filterFn), [list, filterFn]);',
            'const handleClick = useCallback(() => onSelect(id), [onSelect, id]);',
            '```',
            '',
            '上面第一行是在缓存筛选结果，第二行是在缓存点击处理函数；它们解决的不是同一个问题。',
            '',
            '## 面试里怎么回答',
            '- 先一句话说清“一个缓存值，一个缓存函数”。',
            '- 再按“缓存对象是什么、典型场景是什么、什么时候其实没必要用”补 2 到 3 句。',
            '- 最后补一句：不要为了优化而优化，只有引用稳定性或计算成本确实有价值时才用。',
          ].join('\n'),
        },
      ];
    }

    if (intent.style === 'mechanism') {
      return [
        {
          role: 'user',
          content: '事件循环是什么',
        },
        {
          role: 'assistant',
          content: [
            '## 核心结论',
            '事件循环是 JavaScript 运行时用来调度同步任务、微任务和宏任务的机制，它让单线程也能按顺序处理异步工作。很多面试官问这题，本质是在看你是否真的理解“为什么 Promise 通常比 setTimeout 先执行”。',
            '',
            '## 执行流程或工作原理',
            '1. 先执行当前调用栈里的同步代码。',
            '2. 同步代码执行完后，优先清空微任务队列。',
            '3. 再取出一个宏任务执行。',
            '4. 每轮宏任务结束后，再次清空微任务队列。',
            '5. 浏览器会在合适时机插入渲染，所以“任务执行顺序”和“页面什么时候真正更新”也不是一回事。',
            '',
            '## 示例',
            '```javascript',
            "console.log('start');",
            "setTimeout(() => console.log('timeout'), 0);",
            "Promise.resolve().then(() => console.log('promise'));",
            "console.log('end');",
            '```',
            '',
            '输出顺序通常是：`start -> end -> promise -> timeout`。',
            '原因不是 `setTimeout(0)` 真的“立刻执行”，而是它进入的是下一轮宏任务；而 `Promise.then` 属于当前轮结束后就会清空的微任务。',
            '',
            '## 常见追问',
            '- 为什么 `Promise.then` 比 `setTimeout` 先执行？',
            '- 浏览器和 Node.js 的事件循环有什么区别？',
            '- `await`、`queueMicrotask`、DOM 渲染分别插在哪个阶段？',
            '',
            '## 面试回答建议',
            '回答时先给结论，再用“同步代码 -> 微任务 -> 宏任务”的顺序去讲，最后补一句“`setTimeout(0)` 也不会跳过当前调用栈”，面试官会更容易判断你是否真的理解了执行链路。',
          ].join('\n'),
        },
      ];
    }

    return [
      {
        role: 'user',
        content: 'JS闭包是什么',
      },
      {
        role: 'assistant',
        content: [
          '## 定义',
          '闭包是函数与其定义时所处词法作用域的组合，即使函数离开了原来的作用域，仍然可以访问那些变量。',
          '它之所以重要，是因为很多实际能力，例如函数工厂、私有状态、Hook 回调里引用外部变量，本质上都和闭包有关。',
          '',
          '## 核心特点',
          '- 内部函数可以访问外部函数变量。',
          '- 外部函数执行结束后，被引用的变量仍然可能继续存在。',
          '- 常用于封装私有状态和实现函数工厂。',
          '',
          '## 示例',
          '```javascript',
          'function createCounter() {',
          '  let count = 0;',
          '  return function increment() {',
          '    count += 1;',
          '    return count;',
          '  };',
          '}',
          '```',
          '',
          '这个例子里，`increment` 每次都能拿到同一个 `count`，不是因为函数“记住了值”，而是它继续引用着定义时的词法环境。',
          '',
          '## 常见误区或面试追问',
          '- 误区：只要函数嵌套函数就是闭包；关键在于内部函数持有了外部作用域变量。',
          '- 追问：闭包为什么可能导致额外的内存占用？',
          '- 追问：React 里为什么有些回调会出现“闭包拿到旧值”的问题？',
          '',
          '## 一句话总结',
          '闭包的本质，就是函数把定义时的作用域“一起带走”了；面试里如果能再补一句应用场景和内存边界，回答会更完整。',
        ].join('\n'),
      },
    ];
  }

  return [
    {
      role: 'user',
      content: '我是前端工程师，如何挖掘简历项目亮点？',
    },
    {
      role: 'assistant',
      content: [
        '项目亮点不要只写“做了什么”，而要重点写清楚业务价值、技术难点、你的个人贡献和最终结果。',
        '',
        '你可以优先从这 4 个角度梳理：业务场景、难点问题、主导方案、量化结果。',
        '',
        '如果你把一段项目经历贴过来，我可以直接帮你改写成更适合前端求职简历的表达。',
      ].join('\n'),
    },
  ];
}
