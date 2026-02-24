/**
 * Drag-and-drop is supported on desktop web only. Returns false on mobile web.
 */

import {isMobile} from '@libs/Browser';

function useDragAndDropSupport(): boolean {
    return !isMobile();
}

export default useDragAndDropSupport;
