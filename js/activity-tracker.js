// User Activity Tracking System
// Tracks user activities, sessions, and uptime for analytics

class ActivityTracker {
    constructor() {
        this.userId = null;
        this.sessionId = null;
        this.sessionStartTime = null;
        this.lastActivityTime = null;
        this.activityBuffer = [];
        this.isTracking = false;
        this.heartbeatInterval = null;
        this.bufferFlushInterval = null;
    }

    // Initialize activity tracking
    async init() {
        if (this.isTracking) return;

        try {
            this.userId = localStorage.getItem('userId');
            if (!this.userId) {
                console.log('No user ID found, activity tracking disabled');
                return;
            }

            // Start or resume session
            await this.initializeSession();

            // Set up event listeners for activity tracking
            this.setupEventListeners();

            // Start heartbeat to track uptime
            this.startHeartbeat();

            // Start buffer flushing
            this.startBufferFlush();

            this.isTracking = true;
            console.log('Activity tracking initialized');

            // Track page load
            this.trackActivity('page_load', {
                page: window.location.pathname,
                referrer: document.referrer,
                userAgent: navigator.userAgent
            });

        } catch (error) {
            console.error('Failed to initialize activity tracking:', error);
        }
    }

    // Initialize or resume user session
    async initializeSession() {
        try {
            // Check for existing session
            const existingSessionId = sessionStorage.getItem('activity_session_id');

            if (existingSessionId) {
                this.sessionId = existingSessionId;
                // Update last activity time
                await this.updateSessionActivity();
            } else {
                // Create new session
                const response = await fetch('/api/activity/start-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId: this.userId,
                        ipAddress: await this.getClientIP(),
                        userAgent: navigator.userAgent
                    })
                });

                const data = await response.json();
                if (data.success) {
                    this.sessionId = data.sessionId;
                    sessionStorage.setItem('activity_session_id', this.sessionId);
                    this.sessionStartTime = new Date();
                    console.log('New session started:', this.sessionId);
                }
            }

            this.lastActivityTime = new Date();

        } catch (error) {
            console.error('Error initializing session:', error);
        }
    }

    // Update session last activity time
    async updateSessionActivity() {
        if (!this.sessionId) return;

        try {
            await fetch('/api/activity/update-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId })
            });
        } catch (error) {
            console.error('Error updating session activity:', error);
        }
    }

    // Set up event listeners for tracking user activities
    setupEventListeners() {
        // Page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.trackActivity('visibility_change', {
                hidden: document.hidden,
                visibilityState: document.visibilityState
            });
        });

        // Mouse movements (throttled)
        let mouseMoveTimeout;
        document.addEventListener('mousemove', () => {
            if (mouseMoveTimeout) return;
            mouseMoveTimeout = setTimeout(() => {
                this.trackActivity('mouse_movement', {
                    x: event.clientX,
                    y: event.clientY,
                    timestamp: Date.now()
                });
                mouseMoveTimeout = null;
            }, 5000); // Track every 5 seconds
        });

        // Clicks
        document.addEventListener('click', (event) => {
            this.trackActivity('click', {
                x: event.clientX,
                y: event.clientY,
                target: event.target.tagName,
                pageX: event.pageX,
                pageY: event.pageY
            });
        });

        // Form interactions
        document.addEventListener('submit', (event) => {
            this.trackActivity('form_submit', {
                formId: event.target.id,
                formAction: event.target.action,
                formMethod: event.target.method
            });
        });

        // Scrolling
        let scrollTimeout;
        window.addEventListener('scroll', () => {
            if (scrollTimeout) return;
            scrollTimeout = setTimeout(() => {
                this.trackActivity('scroll', {
                    scrollY: window.scrollY,
                    scrollX: window.scrollX,
                    maxScroll: Math.max(
                        document.body.scrollHeight - window.innerHeight,
                        document.documentElement.scrollHeight - window.innerHeight
                    )
                });
                scrollTimeout = null;
            }, 2000);
        });

        // Before unload (page close/refresh)
        window.addEventListener('beforeunload', () => {
            this.trackActivity('page_unload', {
                sessionDuration: this.sessionStartTime ? Date.now() - this.sessionStartTime.getTime() : 0
            });

            // End session
            this.endSession();

            // Flush remaining activities synchronously if possible
            if (navigator.sendBeacon) {
                const activities = this.activityBuffer.splice(0);
                if (activities.length > 0) {
                    navigator.sendBeacon('/api/activity/bulk', JSON.stringify({
                        activities: activities,
                        sessionId: this.sessionId
                    }));
                }
            }
        });

        // Online/offline status
        window.addEventListener('online', () => {
            this.trackActivity('network_status', { status: 'online' });
        });

        window.addEventListener('offline', () => {
            this.trackActivity('network_status', { status: 'offline' });
        });
    }

    // Track a user activity
    trackActivity(activityType, details = {}) {
        if (!this.userId || !this.sessionId) return;

        const activity = {
            userId: this.userId,
            sessionId: this.sessionId,
            activityType: activityType,
            details: details,
            ipAddress: null, // Will be set server-side
            userAgent: navigator.userAgent,
            timestamp: new Date().toISOString()
        };

        // Add to buffer
        this.activityBuffer.push(activity);

        // Update last activity time
        this.lastActivityTime = new Date();

        // Flush immediately for important activities
        if (['page_load', 'page_unload', 'form_submit'].includes(activityType)) {
            this.flushActivities();
        }
    }

    // Flush activities to server
    async flushActivities() {
        if (this.activityBuffer.length === 0) return;

        try {
            const activities = this.activityBuffer.splice(0, 50); // Send max 50 at a time

            const response = await fetch('/api/activity/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    activities: activities,
                    sessionId: this.sessionId
                })
            });

            if (!response.ok) {
                // Re-add activities to buffer if failed
                this.activityBuffer.unshift(...activities);
                console.error('Failed to send activities to server');
            }

        } catch (error) {
            console.error('Error flushing activities:', error);
            // Keep activities in buffer for retry
        }
    }

    // Start heartbeat to track uptime and flush activities
    startHeartbeat() {
        this.heartbeatInterval = setInterval(async () => {
            await this.updateSessionActivity();

            // Calculate uptime and update user record
            if (this.sessionStartTime) {
                const uptimeMinutes = Math.floor((Date.now() - this.sessionStartTime.getTime()) / (1000 * 60));

                // Update user uptime every 5 minutes
                if (uptimeMinutes > 0 && uptimeMinutes % 5 === 0) {
                    await this.updateUserUptime(uptimeMinutes);
                }
            }
        }, 60000); // Every minute
    }

    // Start buffer flushing interval
    startBufferFlush() {
        this.bufferFlushInterval = setInterval(() => {
            this.flushActivities();
        }, 30000); // Every 30 seconds
    }

    // Update user total uptime
    async updateUserUptime(currentSessionUptime) {
        try {
            await fetch('/api/activity/update-uptime', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: this.userId,
                    sessionUptime: currentSessionUptime
                })
            });
        } catch (error) {
            console.error('Error updating user uptime:', error);
        }
    }

    // End current session
    async endSession() {
        if (!this.sessionId) return;

        try {
            const sessionDuration = this.sessionStartTime ?
                Math.floor((Date.now() - this.sessionStartTime.getTime()) / (1000 * 60)) : 0;

            await fetch('/api/activity/end-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    duration: sessionDuration
                })
            });

            console.log('Session ended:', this.sessionId);
        } catch (error) {
            console.error('Error ending session:', error);
        }

        // Clear session data
        sessionStorage.removeItem('activity_session_id');
        this.sessionId = null;
        this.sessionStartTime = null;
    }

    // Get client IP (approximate, server will get real IP)
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }

    // Stop tracking (for cleanup)
    stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        if (this.bufferFlushInterval) {
            clearInterval(this.bufferFlushInterval);
        }

        this.endSession();
        this.isTracking = false;
    }
}

// Global activity tracker instance
const activityTracker = new ActivityTracker();

// Initialize activity tracking when DOM is loaded (only for logged-in users)
document.addEventListener('DOMContentLoaded', function() {
    const userId = localStorage.getItem('userId');
    if (userId) {
        activityTracker.init();
    }
});

// Export for use in other scripts
window.ActivityTracker = ActivityTracker;
window.activityTracker = activityTracker;
