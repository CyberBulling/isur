(function () {
    function sendEvent(eventName) {
        const counter = window.top100Counter;
        if (counter && typeof counter.trackEvent === 'function') {
            counter.trackEvent(eventName);
            return;
        }

        const queue = window._top100q;
        if (Array.isArray(queue)) {
            queue.push(function () {
                const readyCounter = window.top100Counter;
                if (readyCounter && typeof readyCounter.trackEvent === 'function') {
                    readyCounter.trackEvent(eventName);
                } else {
                    console.error(`Top-100 counter is unavailable; event "${eventName}" was not sent.`);
                }
            });
            return;
        }

        console.error(`Top-100 counter is unavailable; event "${eventName}" was not sent.`);
    }

    window.trackIsurAnalyticsEvent = sendEvent;
})();
