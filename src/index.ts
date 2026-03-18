export interface LimitConfig {
  tokens: number;
  duration: number; // milliseconds
}

export interface RateLimiterOptions {
  limits?: LimitConfig[];
  defaultLimit?: LimitConfig;
  flush?: boolean;
  timeout?: number;
  backoff?: number;
  backoffMax?: number;
  queueMax?: number;
}

interface QueueItem {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
  addedAt: number;
}

export class RateLimiter {
  private limits: LimitConfig[];
  private tokens: Map<number, number> = new Map();
  private queue: QueueItem[] = [];
  private processing = false;
  private flush: boolean;
  private timeout: number;
  private backoff: number;
  private backoffMax: number;
  private queueMax: number;

  constructor(options: RateLimiterOptions = {}) {
    this.limits = options.limits || [ { tokens: 10, duration: 1000 } ];
    this.flush = options.flush ?? true;
    this.timeout = options.timeout ?? 30000;
    this.backoff = options.backoff ?? 1000;
    this.backoffMax = options.backoffMax ?? 30000;
    this.queueMax = options.queueMax ?? 1000;

    // Initialize tokens
    this.limits.forEach((limit, idx) => {
      this.tokens.set(idx, limit.tokens);
    });

    // Start refill loop
    this.startRefillLoop();
  }

  private startRefillLoop() {
    setInterval(() => {
      this.limits.forEach((limit, idx) => {
        const current = this.tokens.get(idx) || 0;
        this.tokens.set(idx, Math.min(current + 1, limit.tokens));
      });
      this.processQueue();
    }, this.limits[0]?.duration || 1000);
  }

  private async processQueue() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue[0];
      const canProceed = this.tryConsume();

      if (canProceed) {
        this.queue.shift();
        try {
          const result = await item.fn();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      } else {
        if (this.queue.length >= this.queueMax) {
          const removed = this.queue.shift();
          removed?.reject(new Error('Queue overflow'));
        }
        break;
      }
    }

    this.processing = false;
  }

  private tryConsume(): boolean {
    for (const [idx, limit] of this.limits.entries()) {
      const tokens = this.tokens.get(idx) || 0;
      if (tokens > 0) {
        this.tokens.set(idx, tokens - 1);
        return true;
      }
    }
    return false;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T | null> {
    if (this.tryConsume()) {
      try {
        return await fn();
      } catch (error) {
        throw error;
      }
    }

    if (!this.flush) {
      return null;
    }

    // Add to queue
    return new Promise<T>((resolve, reject) => {
      if (this.queue.length >= this.queueMax) {
        reject(new Error('Queue is full'));
        return;
      }

      this.queue.push({
        fn,
        resolve,
        reject,
        addedAt: Date.now(),
      });

      this.processQueue();
    });
  }

  getStats() {
    return {
      tokens: Object.fromEntries(this.tokens),
      queueLength: this.queue.length,
      limits: this.limits,
    };
  }

  async waitForToken(): Promise<boolean> {
    let waited = 0;
    while (waited < this.timeout) {
      if (this.tryConsume()) return true;
      await new Promise(r => setTimeout(r, 100));
      waited += 100;
    }
    return false;
  }
}

export default RateLimiter;
