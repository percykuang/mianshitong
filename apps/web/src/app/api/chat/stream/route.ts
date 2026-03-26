export async function POST(): Promise<Response> {
  return new Response('旧版游客本地聊天接口已下线，请刷新页面后重试。', {
    status: 410,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
