/**
 * Aceos Affiliate - User Activity Tracking
 * Tracks user interests based on clicks and stores in cookies for ad targeting.
 */

(function() {
    console.log("Aceos Tracking Initialized");

    // Helper to set cookie
    function setCookie(name, value, days) {
        var expires = "";
        if (days) {
            var date = new Date();
            date.setTime(date.getTime() + (days*24*60*60*1000));
            expires = "; expires=" + date.toUTCString();
        }
        document.cookie = name + "=" + (value || "")  + expires + "; path=/";
        console.log("Tracking: Interest saved - " + value);
    }

    // Helper to get cookie
    function getCookie(name) {
        var nameEQ = name + "=";
        var ca = document.cookie.split(';');
        for(var i=0;i < ca.length;i++) {
            var c = ca[i];
            while (c.charAt(0)==' ') c = c.substring(1,c.length);
            if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
        }
        return null;
    }

    // Attach listeners to category links
    document.addEventListener('DOMContentLoaded', function() {
        var links = document.querySelectorAll('a');
        links.forEach(function(link) {
            link.addEventListener('click', function(e) {
                var text = this.innerText || "";
                var type = "";
                
                // Determine interest based on keywords
                if(text.match(/Health|Beauty|Spa/i)) type = "Health & Beauty";
                else if(text.match(/Sport|Fitness|Gym/i)) type = "Sports & Fitness";
                else if(text.match(/Restaurant|Food|Dining/i)) type = "Restaurants";
                else if(text.match(/Tech|Electronics|Mobile/i)) type = "Electronics";
                else if(text.match(/Fashion|Clothes|Style/i)) type = "Fashion";

                if(type) {
                    setCookie("aceos_interest", type, 30);
                    // Simulate Ad Targeting
                    console.log("Ad Server: User interested in " + type + ". Loading relevant creatives...");
                }
            });
        });

        // Simulate Ad Display based on history
        var currentInterest = getCookie("aceos_interest");
        if(currentInterest) {
            console.log("Ad Server: Welcome back! Servicing ads for " + currentInterest);
            // In a real system, this would fetch specific banners. 
            // Here, we could dynamically update a banner if we wanted, but console log suffices for simulation.
        }
    });

})();
