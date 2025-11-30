import { Logger } from '@nestjs/common';

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  maxDelayMs?: number;
}

const defaultOptions: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
  logger?: Logger,
  operationName: string = 'Operation',
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: Error;
  let delay = opts.delayMs;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === opts.maxAttempts) {
        if (logger) {
          logger.error(
            `${operationName} failed after ${opts.maxAttempts} attempts: ${error.message}`,
          );
        }
        throw error;
      }

      if (logger) {
        logger.warn(
          `${operationName} attempt ${attempt}/${opts.maxAttempts} failed: ${error.message}. ` +
          `Retrying in ${delay}ms...`,
        );
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelayMs);
    }
  }

  throw lastError;
}

