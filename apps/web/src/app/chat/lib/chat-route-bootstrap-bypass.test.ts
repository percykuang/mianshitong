import { describe, expect, it } from 'vitest';
import {
  clearRouteBootstrapBypass,
  hasRouteBootstrapBypass,
  markRouteBootstrapBypass,
} from './chat-route-bootstrap-bypass';

describe('chat-route-bootstrap-bypass', () => {
  it('支持标记、查询和清除 session 路由跳过状态', () => {
    const sessionId = 'bypass_session_1';

    expect(hasRouteBootstrapBypass(sessionId)).toBe(false);
    markRouteBootstrapBypass(sessionId);
    expect(hasRouteBootstrapBypass(sessionId)).toBe(true);
    clearRouteBootstrapBypass(sessionId);
    expect(hasRouteBootstrapBypass(sessionId)).toBe(false);
  });
});
