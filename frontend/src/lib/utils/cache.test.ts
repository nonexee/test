import { SimpleCache, CacheKeys } from './cache';

describe('SimpleCache', () => {
  let cache: SimpleCache;

  beforeEach(() => {
    cache = new (SimpleCache as any)();
  });

  describe('set and get', () => {
    it('should store and retrieve data', () => {
      cache.set('test-key', { data: 'test value' });
      const result = cache.get('test-key');
      expect(result).toEqual({ data: 'test value' });
    });

    it('should return null for non-existent key', () => {
      const result = cache.get('non-existent');
      expect(result).toBeNull();
    });

    it('should respect custom TTL', () => {
      jest.useFakeTimers();

      cache.set('test-key', 'value', 1000); // 1 second TTL

      // Immediately after setting
      expect(cache.get('test-key')).toBe('value');

      // After 500ms (within TTL)
      jest.advanceTimersByTime(500);
      expect(cache.get('test-key')).toBe('value');

      // After 1500ms (expired)
      jest.advanceTimersByTime(600);
      expect(cache.get('test-key')).toBeNull();

      jest.useRealTimers();
    });

    it('should use default TTL when not specified', () => {
      jest.useFakeTimers();

      cache.set('test-key', 'value'); // Should use default 5 minutes

      jest.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      expect(cache.get('test-key')).toBe('value');

      jest.advanceTimersByTime(2 * 60 * 1000); // 6 minutes total
      expect(cache.get('test-key')).toBeNull();

      jest.useRealTimers();
    });
  });

  describe('has', () => {
    it('should return true for existing non-expired keys', () => {
      cache.set('test-key', 'value');
      expect(cache.has('test-key')).toBe(true);
    });

    it('should return false for non-existent keys', () => {
      expect(cache.has('non-existent')).toBe(false);
    });

    it('should return false for expired keys', () => {
      jest.useFakeTimers();

      cache.set('test-key', 'value', 100);
      expect(cache.has('test-key')).toBe(true);

      jest.advanceTimersByTime(200);
      expect(cache.has('test-key')).toBe(false);

      jest.useRealTimers();
    });
  });

  describe('delete', () => {
    it('should remove a key from cache', () => {
      cache.set('test-key', 'value');
      expect(cache.has('test-key')).toBe(true);

      cache.delete('test-key');
      expect(cache.has('test-key')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(false);
      expect(cache.has('key3')).toBe(false);
    });
  });

  describe('clearPattern', () => {
    it('should clear entries matching a pattern', () => {
      cache.set('vendors:list:page1', 'data1');
      cache.set('vendors:list:page2', 'data2');
      cache.set('vendors:detail:123', 'data3');
      cache.set('other:data', 'data4');

      cache.clearPattern('vendors:list');

      expect(cache.has('vendors:list:page1')).toBe(false);
      expect(cache.has('vendors:list:page2')).toBe(false);
      expect(cache.has('vendors:detail:123')).toBe(true);
      expect(cache.has('other:data')).toBe(true);
    });
  });

  describe('getStats', () => {
    it('should return cache statistics', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.getStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('key1');
      expect(stats.keys).toContain('key2');
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', () => {
      jest.useFakeTimers();

      cache.set('key1', 'value1', 1000);
      cache.set('key2', 'value2', 5000);
      cache.set('key3', 'value3', 10000);

      // Advance time to expire key1
      jest.advanceTimersByTime(2000);

      cache.cleanup();

      expect(cache.has('key1')).toBe(false);
      expect(cache.has('key2')).toBe(true);
      expect(cache.has('key3')).toBe(true);

      jest.useRealTimers();
    });
  });
});

describe('CacheKeys', () => {
  describe('vendors.list', () => {
    it('should generate consistent keys for the same filters', () => {
      const key1 = CacheKeys.vendors.list({ type: 'SAAS', criticality: 'HIGH' });
      const key2 = CacheKeys.vendors.list({ type: 'SAAS', criticality: 'HIGH' });

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different filters', () => {
      const key1 = CacheKeys.vendors.list({ type: 'SAAS' });
      const key2 = CacheKeys.vendors.list({ type: 'CLOUD_INFRA' });

      expect(key1).not.toBe(key2);
    });

    it('should handle empty filters', () => {
      const key = CacheKeys.vendors.list();
      expect(key).toBe('vendors:list:');
    });

    it('should include search in key', () => {
      const key = CacheKeys.vendors.list({ search: 'test' });
      expect(key).toContain('search=test');
    });
  });

  describe('vendors.detail', () => {
    it('should generate key with vendor ID', () => {
      const key = CacheKeys.vendors.detail('vendor-123');
      expect(key).toContain('vendor-123');
    });

    it('should include jobs page in key', () => {
      const key = CacheKeys.vendors.detail('vendor-123', 2);
      expect(key).toContain(':jobs:2');
    });

    it('should default to page 1 when not specified', () => {
      const key = CacheKeys.vendors.detail('vendor-123');
      expect(key).toContain(':jobs:1');
    });
  });
});
