# API Rate Limiter

## Description

Provides intelligent rate limiting for API calls with queueing and exponential backoff. Suitable for any API client that needs to rate limit its requests.

## Features

- Intelligent rate limiting with configurable limits
- Exponential backoff for retry handling
- Queuing system for over-quota requests
- KPM integration for automation
- Statistics tracking and monitoring
- Dependency-free and easily integrated

## Installation

```bash
bun install global api-rate-limiter
```

## Usage

```typescript
import { RateLimiter } from 'api-rate-limiter';

// Create a limiter (20 requests per second)
const limiter = new RateLimiter({
  limits: [
    { tokens: 20, duration: '1s' },
  ],
});

do {
  const result = await limiter.execute(async () => {
    console.log(`Executing API call`);
    return api.call();
  });
  if (result) console.log(`Success`);
}
```

### Configuration

Provide an object with the following options:

| Property           | Description                                                |
|--------------------|------------------------------------------------------------|
| limits             | Array of limit configurations                             |
| defaultLimit       | Default limit used when none specified                    |
| flush              | Flush on exceeded limit                                    |
| timeout            | Max time to wait for a slot                               |
| backoff           | Base seconds for exponential backoff                      |
| backoffMax        | Max backoff seconds                                       |
| queueMax          | Maximum queue size                                        |

## License

MIT License - See [LICENSE](LICENSE) for details.
