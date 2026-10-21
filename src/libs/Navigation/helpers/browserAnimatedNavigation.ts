let isBrowserAnimatedNavigation = false;
let isTracking = false;

const listeners = new Set<() => void>();

function setIsBrowserAnimatedNavigation(value: boolean) {
    if (isBrowserAnimatedNavigation === value) {
        return;
    }
    isBrowserAnimatedNavigation = value;
    for (const listener of listeners) {
        listener();
    }
}

function initBrowserAnimatedNavigationTracking() {
    if (isTracking) {
        return;
    }
    isTracking = true;

    window.addEventListener(
        'popstate',
        (event: PopStateEvent & {hasUAVisualTransition?: boolean}) => {
            if (!event.hasUAVisualTransition) {
                return;
            }
            setIsBrowserAnimatedNavigation(true);

            // Navigation state updates synchronously during popstate, so the flag only needs to last this task
            setTimeout(() => setIsBrowserAnimatedNavigation(false), 0);
        },
        true,
    );
}

function subscribeToBrowserAnimatedNavigation(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getIsBrowserAnimatedNavigation() {
    return isBrowserAnimatedNavigation;
}

export {initBrowserAnimatedNavigationTracking, subscribeToBrowserAnimatedNavigation, getIsBrowserAnimatedNavigation};
