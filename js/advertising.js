// Advertising Display System
// Handles random ad display, click tracking, and revenue generation

class AdvertisingSystem {
    constructor() {
        this.ads = [];
        this.currentAd = null;
        this.cookieName = 'aceos_ad_tracking';
        this.impressionValue = 0.001; // $0.001 per impression
        this.clickValue = 0.05; // $0.05 per click
        this.initialized = false;
    }

    // Initialize the advertising system
    async init() {
        if (this.initialized) return;

        try {
            // Load active ads from server
            await this.loadAds();

            // Set up ad display containers
            this.setupAdContainers();

            // Display initial ads
            this.displayRandomAd();

            // Set up periodic ad rotation
            setInterval(() => {
                this.displayRandomAd();
            }, 30000); // Rotate ads every 30 seconds

            this.initialized = true;
            console.log('Advertising system initialized');

        } catch (error) {
            console.error('Failed to initialize advertising system:', error);
        }
    }

    // Load active ads from the server
    async loadAds() {
        try {
            const response = await fetch('/api/ads/active');
            const data = await response.json();

            if (data.success) {
                this.ads = data.ads;
                console.log(`Loaded ${this.ads.length} active ads`);
            } else {
                console.warn('Failed to load ads:', data.message);
            }
        } catch (error) {
            console.error('Error loading ads:', error);
        }
    }

    // Set up ad display containers on the page
    setupAdContainers() {
        // Create ad containers if they don't exist
        if (!document.getElementById('sidebar-ad-container')) {
            const sidebarAd = document.createElement('div');
            sidebarAd.id = 'sidebar-ad-container';
            sidebarAd.className = 'sidebar-ad-container';
            sidebarAd.style.cssText = `
                position: fixed;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                width: 300px;
                z-index: 1000;
            `;

            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 50%;
                width: 25px;
                height: 25px;
                cursor: pointer;
                z-index: 1001;
            `;
            closeBtn.onclick = () => {
                sidebarAd.style.display = 'none';
                this.setCookie('sidebar_ad_hidden', 'true', 24); // Hide for 24 hours
            };

            sidebarAd.appendChild(closeBtn);
            document.body.appendChild(sidebarAd);
        }

        if (!document.getElementById('banner-ad-container')) {
            const bannerAd = document.createElement('div');
            bannerAd.id = 'banner-ad-container';
            bannerAd.className = 'banner-ad-container';
            bannerAd.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 90px;
                background: white;
                border-top: 1px solid #ddd;
                z-index: 1000;
                display: none;
            `;

            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                position: absolute;
                top: 5px;
                right: 5px;
                background: #6c757d;
                color: white;
                border: none;
                border-radius: 50%;
                width: 25px;
                height: 25px;
                cursor: pointer;
            `;
            closeBtn.onclick = () => {
                bannerAd.style.display = 'none';
                this.setCookie('banner_ad_hidden', 'true', 24);
            };

            bannerAd.appendChild(closeBtn);
            document.body.appendChild(bannerAd);
        }

        if (!document.getElementById('popup-ad-container')) {
            const popupAd = document.createElement('div');
            popupAd.id = 'popup-ad-container';
            popupAd.className = 'popup-ad-container';
            popupAd.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                max-width: 400px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                display: none;
            `;

            // Add close button
            const closeBtn = document.createElement('button');
            closeBtn.innerHTML = '×';
            closeBtn.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: #dc3545;
                color: white;
                border: none;
                border-radius: 50%;
                width: 30px;
                height: 30px;
                cursor: pointer;
                font-size: 18px;
            `;
            closeBtn.onclick = () => {
                popupAd.style.display = 'none';
                this.setCookie('popup_ad_hidden', 'true', 24);
            };

            popupAd.appendChild(closeBtn);
            document.body.appendChild(popupAd);
        }
    }

    // Display a random ad
    displayRandomAd() {
        if (this.ads.length === 0) return;

        // Filter ads based on user targeting and priority
        const availableAds = this.ads.filter(ad => {
            // Check if ad is hidden by user
            if (ad.ad_type === 'sidebar' && this.getCookie('sidebar_ad_hidden')) return false;
            if (ad.ad_type === 'banner' && this.getCookie('banner_ad_hidden')) return false;
            if (ad.ad_type === 'popup' && this.getCookie('popup_ad_hidden')) return false;

            return ad.is_active;
        });

        if (availableAds.length === 0) return;

        // Select ad based on priority (weighted random)
        const totalPriority = availableAds.reduce((sum, ad) => sum + ad.display_priority, 0);
        let random = Math.random() * totalPriority;

        for (const ad of availableAds) {
            random -= ad.display_priority;
            if (random <= 0) {
                this.currentAd = ad;
                break;
            }
        }

        if (!this.currentAd) {
            this.currentAd = availableAds[Math.floor(Math.random() * availableAds.length)];
        }

        // Display the ad based on its type
        this.renderAd(this.currentAd);

        // Track impression
        this.trackImpression(this.currentAd.id);
    }

    // Render ad in the appropriate container
    renderAd(ad) {
        const adElement = document.createElement('div');
        adElement.className = 'ad-content';
        adElement.style.cssText = `
            padding: 15px;
            cursor: pointer;
            text-align: center;
        `;

        // Create ad content
        let content = '';
        if (ad.image_url) {
            content += `<img src="${ad.image_url}" alt="${ad.title}" style="max-width: 100%; max-height: 200px; margin-bottom: 10px;">`;
        }

        content += `<h4 style="margin: 5px 0; color: #333;">${ad.title}</h4>`;

        if (ad.content) {
            content += `<p style="margin: 5px 0; color: #666; font-size: 14px;">${ad.content}</p>`;
        }

        adElement.innerHTML = content;

        // Add click handler
        adElement.onclick = () => {
            this.trackClick(ad.id);
            if (ad.target_url) {
                window.open(ad.target_url, '_blank');
            }
        };

        // Get the appropriate container
        let container;
        switch (ad.ad_type) {
            case 'sidebar':
                container = document.getElementById('sidebar-ad-container');
                break;
            case 'banner':
                container = document.getElementById('banner-ad-container');
                container.style.display = 'block';
                break;
            case 'popup':
                container = document.getElementById('popup-ad-container');
                container.style.display = 'block';
                break;
            default:
                container = document.getElementById('sidebar-ad-container');
        }

        if (container) {
            // Clear existing content (except close button)
            const existingContent = container.querySelector('.ad-content');
            if (existingContent) {
                existingContent.remove();
            }

            container.appendChild(adElement);
            container.style.display = ad.ad_type === 'popup' ? 'block' : 'block';
        }
    }

    // Track ad impression
    async trackImpression(adId) {
        try {
            const response = await fetch('/api/ads/impression', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adId: adId,
                    userId: localStorage.getItem('userId') || null,
                    sessionId: this.getSessionId()
                })
            });

            const data = await response.json();
            if (data.success) {
                // Update local ad data
                const ad = this.ads.find(a => a.id === adId);
                if (ad) {
                    ad.impressions++;
                }
            }
        } catch (error) {
            console.error('Error tracking impression:', error);
        }
    }

    // Track ad click
    async trackClick(adId) {
        try {
            const response = await fetch('/api/ads/click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    adId: adId,
                    userId: localStorage.getItem('userId') || null,
                    sessionId: this.getSessionId()
                })
            });

            const data = await response.json();
            if (data.success) {
                // Update local ad data
                const ad = this.ads.find(a => a.id === adId);
                if (ad) {
                    ad.clicks++;
                }
                console.log('Ad click tracked successfully');
            }
        } catch (error) {
            console.error('Error tracking click:', error);
        }
    }

    // Generate or get session ID
    getSessionId() {
        let sessionId = this.getCookie('ad_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            this.setCookie('ad_session_id', sessionId, 1); // 1 hour session
        }
        return sessionId;
    }

    // Cookie utility functions
    setCookie(name, value, hours) {
        const expires = new Date();
        expires.setTime(expires.getTime() + hours * 60 * 60 * 1000);
        document.cookie = name + '=' + value + ';expires=' + expires.toUTCString() + ';path=/';
    }

    getCookie(name) {
        const nameEQ = name + '=';
        const ca = document.cookie.split(';');
        for (let i = 0; i < ca.length; i++) {
            let c = ca[i];
            while (c.charAt(0) === ' ') c = c.substring(1, c.length);
            if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
        }
        return null;
    }

    // Refresh ads (call this when ads are updated)
    async refreshAds() {
        await this.loadAds();
        this.displayRandomAd();
    }
}

// Global advertising system instance
const adSystem = new AdvertisingSystem();

// Initialize advertising system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only show ads to non-admin users
    const userRole = localStorage.getItem('role');
    if (userRole !== 'admin') {
        adSystem.init();
    }
});

// Export for use in other scripts
window.AdvertisingSystem = AdvertisingSystem;
window.adSystem = adSystem;
