export const CHAT_HEADER_COPY = {
  collapseSidebar: '收起侧边栏',
  expandSidebar: '展开侧边栏',
} as const;

export const CHAT_SIDEBAR_COPY = {
  closeSidebar: '关闭侧栏',
  deleteAllSessions: '删除所有会话记录',
  newChat: '新建会话',
  emptyState: '新建一个会话后，你的聊天记录会展示在这里。',
} as const;

export const CHAT_SESSION_ITEM_COPY = {
  moreActions: '更多会话操作',
  pin: '置顶',
  unpin: '取消置顶',
  rename: '重命名',
  delete: '删除',
} as const;

export const CHAT_SESSION_DIALOG_COPY = {
  renameTitle: '重命名会话',
  renameDescription: '修改后的名称会同步更新到侧边栏和当前会话标题。',
  renamePlaceholder: '请输入新的会话名称',
  cancel: '取消',
  confirm: '确定',
  deleteSessionTitle: '删除当前会话？',
  deleteSessionDescription: (title: string) => `会话“${title}”删除后将无法恢复，请确认是否继续。`,
  deleteAllTitle: '删除所有会话记录？',
  deleteAllDescription: '这会清空当前账号或当前浏览器下的全部会话记录，且无法恢复。',
  deleteAllConfirm: '全部删除',
} as const;

export const CHAT_FEEDBACK_COPY = {
  clipboardFailure: '复制失败，请手动复制。',
  replyInProgress: 'AI 回复生成中，请先停止当前回复',
} as const;

export const CHAT_MESSAGE_ACTIONS_COPY = {
  copy: '复制',
  editMessage: '编辑消息',
  upvoteReply: '赞同回复',
  downvoteReply: '不赞同回复',
  copyCode: '复制代码',
  downloadCode: '下载代码',
} as const;

export const CHAT_ERROR_COPY = {
  requestFailed: '请求失败',
  initFailed: '初始化失败',
  usageInitFailed: '额度初始化失败',
  deleteSessionFailed: '删除会话失败',
  deleteAllSessionsFailed: '删除所有会话失败',
  sendFailed: '发送失败，请稍后重试',
  editFailed: '编辑失败，请稍后重试',
  feedbackFailed: '记录反馈失败',
  pinSessionFailed: '置顶会话失败',
  renameSessionFailed: '重命名会话失败',
  streamFailed: '模型调用失败，请稍后重试',
  emptyStream: '流式响应为空',
  invalidEditableMessage: '目标消息不存在或不可编辑',
  editOnlyLastUserMessage: '当前仅支持编辑最后一条用户消息',
} as const;
