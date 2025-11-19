/**
 * Basic analytics and observability utility for tracking user interactions and errors
 * LOW #48 fix: Provides foundation for monitoring and debugging in production
 */

type EventType = 'page_view' | 'user_action' | 'error' | 'performance';

interface AnalyticsEvent {
  type: EventType;
  name: string;
  properties?: Record<string, any>;
  timestamp: number;
}

class Analytics {
  private enabled: boolean;
  private events: AnalyticsEvent[] = [];
  private maxEvents = 100; // Keep last 100 events in memory

  constructor() {
    // Enable analytics in production, disable in development
    this.enabled = process.env.NODE_ENV === 'production';
    this.setupErrorTracking();
    this.setupPerformanceTracking();
  }

  /**
   * Track a page view
   */
  trackPageView(page: string, properties?: Record<string, any>) {
    this.track('page_view', page, properties);
  }

  /**
   * Track a user action
   */
  trackAction(action: string, properties?: Record<string, any>) {
    this.track('user_action', action, properties);
  }

  /**
   * Track an error
   */
  trackError(error: Error, context?: Record<string, any>) {
    this.track('error', error.message, {
      ...context,
      stack: error.stack,
      name: error.name,
    });

    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.error('[Analytics] Error tracked:', error, context);
    }
  }

  /**
   * Track a performance metric
   */
  trackPerformance(metric: string, value: number, unit: string = 'ms') {
    this.track('performance', metric, { value, unit });
  }

  /**
   * Core tracking method
   */
  private track(type: EventType, name: string, properties?: Record<string, any>) {
    const event: AnalyticsEvent = {
      type,
      name,
      properties,
      timestamp: Date.now(),
    };

    // Store in memory (for debugging and local testing)
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    // In production, this would send to an analytics service
    // For now, we just log to console in development
    if (!this.enabled) {
      console.log('[Analytics]', {
        type,
        name,
        ...properties,
      });
    }

    // In production, you would send to your analytics backend:
    // if (this.enabled) {
    //   fetch('/api/analytics', {
    //     method: 'POST',
    //     body: JSON.stringify(event),
    //   }).catch(console.error);
    // }
  }

  /**
   * Set up global error tracking
   */
  private setupErrorTracking() {
    if (typeof window === 'undefined') return;

    // Track unhandled errors
    window.addEventListener('error', (event) => {
      this.trackError(new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          type: 'unhandledRejection',
        }
      );
    });
  }

  /**
   * Set up performance tracking
   */
  private setupPerformanceTracking() {
    if (typeof window === 'undefined' || !window.performance) return;

    // Track page load time
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.trackPerformance('page_load_time', navigation.loadEventEnd - navigation.fetchStart);
          this.trackPerformance('dom_content_loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart);
        }
      }, 0);
    });
  }

  /**
   * Get recent events (for debugging)
   */
  getRecentEvents(limit?: number): AnalyticsEvent[] {
    return this.events.slice(-(limit || 20));
  }

  /**
   * Clear all stored events
   */
  clearEvents() {
    this.events = [];
  }

  /**
   * Get analytics summary
   */
  getSummary() {
    const eventsByType = this.events.reduce((acc, event) => {
      acc[event.type] = (acc[event.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errors = this.events.filter(e => e.type === 'error');
    const avgPerformance = this.events
      .filter(e => e.type === 'performance')
      .reduce((sum, e) => sum + (e.properties?.value || 0), 0) /
      Math.max(1, this.events.filter(e => e.type === 'performance').length);

    return {
      totalEvents: this.events.length,
      eventsByType,
      errorCount: errors.length,
      recentErrors: errors.slice(-5).map(e => e.name),
      avgPerformance: Math.round(avgPerformance),
    };
  }
}

// Export singleton instance
export const analytics = new Analytics();

// Export type for external use
export type { AnalyticsEvent };

// Helper hook for React components
export function useAnalytics() {
  return {
    trackPageView: analytics.trackPageView.bind(analytics),
    trackAction: analytics.trackAction.bind(analytics),
    trackError: analytics.trackError.bind(analytics),
    trackPerformance: analytics.trackPerformance.bind(analytics),
  };
}
