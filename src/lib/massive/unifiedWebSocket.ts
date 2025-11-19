/**
 * Unified Massive WebSocket Client
 * 
 * Single connection to wss://socket.massive.com with:
 * - OPTIONS ADVANCED: bars, trades, quotes for underlying roots
 * - INDICES ADVANCED: bars for I:SPX, I:NDX, I:VIX, I:RVX
 * 
 * Docs: https://massive.com/docs/websocket
 */

type MessageHandler = (event: any) => void;
type StatusHandler = (status: 'connecting' | 'connected' | 'authenticated' | 'disconnected' | 'error') => void;

interface UnifiedWSConfig {
  url?: string;
  token: string;
  onMessage: MessageHandler;
  onStatus?: StatusHandler;
  reconnectDelay?: number;
}

export class UnifiedMassiveWebSocket {
  private ws: WebSocket | null = null;
  private config: UnifiedWSConfig;
  private authenticated = false;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private subscribedChannels = new Set<string>();
  private pendingChannels = new Set<string>();

  constructor(config: UnifiedWSConfig) {
    this.config = {
      url: 'wss://socket.massive.com',
      reconnectDelay: 3000,
      ...config,
    };
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[UnifiedWS] Already connected or connecting');
      return;
    }

    this.updateStatus('connecting');
    console.log(`[UnifiedWS] Connecting to ${this.config.url}`);

    this.ws = new WebSocket(this.config.url!);

    this.ws.onopen = () => {
      console.log('[UnifiedWS] ✅ Connected');
      this.updateStatus('connected');
      this.authenticate();
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const messages = JSON.parse(event.data);
        const arr = Array.isArray(messages) ? messages : [messages];

        for (const msg of arr) {
          // Handle status messages
          if (msg.ev === 'status') {
            this.handleStatusMessage(msg);
            continue;
          }

          // Forward data messages to handler
          this.config.onMessage(msg);
        }
      } catch (e) {
        console.error('[UnifiedWS] Failed to parse message:', e);
      }
    };

    this.ws.onerror = (error) => {
      console.error('[UnifiedWS] Error:', error);
      this.updateStatus('error');
    };

    this.ws.onclose = (event) => {
      console.warn('[UnifiedWS] Disconnected:', event.code, event.reason);
      this.authenticated = false;
      this.updateStatus('disconnected');
      this.stopHeartbeat();
      this.scheduleReconnect();
    };
  }

  private authenticate() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    console.log('[UnifiedWS] Authenticating...');
    this.send({ action: 'auth', params: this.config.token });
  }

  private handleStatusMessage(msg: any) {
    console.log('[UnifiedWS] Status:', msg);

    if (msg.status === 'auth_success') {
      console.log('[UnifiedWS] ✅ Authenticated');
      this.authenticated = true;
      this.updateStatus('authenticated');
      this.flushPendingSubscriptions();
    } else if (msg.status === 'auth_failed') {
      console.error('[UnifiedWS] ❌ Authentication failed:', msg.message);
      this.disconnect();
    } else if (msg.status === 'success' && msg.message) {
      console.log('[UnifiedWS] Success:', msg.message);
    } else if (msg.status === 'error') {
      console.error('[UnifiedWS] Error:', msg.message);
    }
  }

  private flushPendingSubscriptions() {
    if (this.pendingChannels.size === 0) return;

    const channels = Array.from(this.pendingChannels);
    console.log('[UnifiedWS] Flushing pending subscriptions:', channels);
    
    this.send({ action: 'subscribe', params: channels.join(',') });
    
    channels.forEach(ch => {
      this.subscribedChannels.add(ch);
      this.pendingChannels.delete(ch);
    });
  }

  /**
   * Subscribe to channels. Format examples:
   * - Options bars: "A.O:SPY251219C00650000" (1-second aggregates)
   * - Options trades: "T.O:SPY251219C00650000"
   * - Options quotes: "Q.O:SPY251219C00650000"
   * - Indices bars: "AM.I:SPX" (1-minute aggregates)
   * - Indices value: "V.I:SPX"
   */
  subscribe(channels: string[]) {
    const newChannels = channels.filter(ch => !this.subscribedChannels.has(ch));
    if (newChannels.length === 0) return;

    console.log('[UnifiedWS] Subscribing:', newChannels);

    if (this.authenticated && this.ws?.readyState === WebSocket.OPEN) {
      this.send({ action: 'subscribe', params: newChannels.join(',') });
      newChannels.forEach(ch => this.subscribedChannels.add(ch));
    } else {
      // Queue for auth completion
      newChannels.forEach(ch => this.pendingChannels.add(ch));
    }
  }

  /**
   * Unsubscribe from channels
   */
  unsubscribe(channels: string[]) {
    const toUnsub = channels.filter(ch => this.subscribedChannels.has(ch));
    if (toUnsub.length === 0) return;

    console.log('[UnifiedWS] Unsubscribing:', toUnsub);

    if (this.authenticated && this.ws?.readyState === WebSocket.OPEN) {
      this.send({ action: 'unsubscribe', params: toUnsub.join(',') });
    }

    toUnsub.forEach(ch => {
      this.subscribedChannels.delete(ch);
      this.pendingChannels.delete(ch);
    });
  }

  private send(data: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[UnifiedWS] Cannot send, socket not open');
      return;
    }

    this.ws.send(JSON.stringify(data));
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ action: 'ping' }));
      }
    }, 30000); // 30s
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;

    console.log(`[UnifiedWS] Reconnecting in ${this.config.reconnectDelay}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.config.reconnectDelay);
  }

  private updateStatus(status: 'connecting' | 'connected' | 'authenticated' | 'disconnected' | 'error') {
    this.config.onStatus?.(status);
  }

  disconnect() {
    console.log('[UnifiedWS] Disconnecting...');
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.onclose = null; // Prevent reconnect
      this.ws.close();
      this.ws = null;
    }

    this.authenticated = false;
    this.subscribedChannels.clear();
    this.pendingChannels.clear();
    this.updateStatus('disconnected');
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN && this.authenticated;
  }

  getSubscribedChannels(): string[] {
    return Array.from(this.subscribedChannels);
  }
}
