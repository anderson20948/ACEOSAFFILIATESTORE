/**
 * js/dashboard-stats.js
 * Centralized stats engine for the Aceos Dashboard.
 * Fetches real-time affiliate stats and broadcasts them to all listeners.
 */

async function refreshDashboardStats() {
    if (typeof safeFetch !== 'function') {
        console.warn('safeFetch not found. Dashboard stats engine requires utils.js');
        return;
    }

    try {
        const data = await safeFetch('/api/affiliate/stats');
        if (data && data.success) {
            // Dispatch global event for all components to listen to
            const event = new CustomEvent('aceos_stats_updated', {
                detail: data.stats
            });
            window.dispatchEvent(event);
            
            // Log for debugging
            console.log('Dashboard stats updated:', data.stats);
        }
    } catch (err) {
        console.error('Failed to refresh dashboard stats:', err);
    }
}

// Auto-refresh every 30 seconds
let statsInterval = null;

function startStatsEngine() {
    if (statsInterval) clearInterval(statsInterval);
    
    // Initial fetch
    refreshDashboardStats();
    
    // Set interval
    statsInterval = setInterval(refreshDashboardStats, 30000);
}

// Start if logged in
document.addEventListener('DOMContentLoaded', () => {
    if (typeof isLoggedIn === 'function' && isLoggedIn()) {
        startStatsEngine();
    }
});
