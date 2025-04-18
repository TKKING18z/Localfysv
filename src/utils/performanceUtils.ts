/**
 * Performance optimization utilities
 */
import React from 'react';
import { InteractionManager, unstable_batchedUpdates } from 'react-native';

/**
 * Returns a memoized version of the callback that only changes if one of the dependencies has changed.
 * This is a type-safe wrapper around React.useCallback
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T,
  dependencies: React.DependencyList
): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return React.useCallback(callback, dependencies);
}

/**
 * Schedule a function to run after interactions and animations have completed
 * @param task The function to run
 * @param delay Optional delay in ms
 */
export function runAfterInteractions(task: () => void, delay = 0): void {
  InteractionManager.runAfterInteractions(() => {
    if (delay > 0) {
      setTimeout(task, delay);
    } else {
      task();
    }
  });
}

/**
 * Batches updates to avoid triggering too many renders
 */
export class BatchedUpdates {
  private queue: (() => void)[] = [];
  private timeout: NodeJS.Timeout | null = null;
  private delay: number;

  constructor(delay = 16) {
    this.delay = delay;
  }

  /**
   * Add an update to the batch
   */
  public enqueue(update: () => void): void {
    this.queue.push(update);
    
    if (!this.timeout) {
      this.timeout = setTimeout(() => {
        this.flush();
      }, this.delay);
    }
  }

  /**
   * Process all queued updates immediately
   */
  public flush(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.queue.length > 0) {
      const updates = [...this.queue];
      this.queue = [];
      
      unstable_batchedUpdates(() => {
        updates.forEach(update => update());
      });
    }
  }

  /**
   * Clear all pending updates without executing them
   */
  public clear(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
    this.queue = [];
  }
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * @param func Function to debounce
 * @param wait Milliseconds to delay
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait = 300
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(...args: Parameters<T>): void {
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Creates a throttled function that only invokes func at most once per every limit milliseconds
 * @param func Function to throttle
 * @param limit Milliseconds to limit invocation
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit = 300
): (...args: Parameters<T>) => void {
  let lastCall = 0;
  let timeout: NodeJS.Timeout | null = null;
  let lastArgs: Parameters<T> | null = null;
  
  return function(...args: Parameters<T>): void {
    const now = Date.now();
    
    if (now - lastCall >= limit) {
      lastCall = now;
      func(...args);
    } else {
      lastArgs = args;
      
      if (!timeout) {
        timeout = setTimeout(() => {
          lastCall = Date.now();
          timeout = null;
          
          if (lastArgs) {
            func(...lastArgs);
            lastArgs = null;
          }
        }, limit - (now - lastCall));
      }
    }
  };
} 