import {isMobile} from '@libs/Browser';

/**
 * Drag-and-drop is supported on desktop web only. Returns false on mobile web.
 */
function useDragAndDropSupport(): boolean {
    return !isMobile();
}

export default useDragAndDropSupport;
