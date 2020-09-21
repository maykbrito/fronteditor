// need to implement pub/sub to make it more flexible
export default function() {
    let 
        isResizing = false,
        lastDownX = 0,
        clientX;


    let container = document.getElementById('container'),
        left = document.getElementById('left_panel'),
        right = document.getElementById('right_panel'),
        handle = document.getElementById('drag');


    /* when draggin, need to update .tab-links size */
    function updateTabLinksSize() {
        const tabLinks = document.querySelector('.tab-links')

        if(isResizing) {
            var offsetRight = container.offsetWidth - (clientX - offset(container).left);

            tabLinks.style.right = offsetRight + 'px'
        }
    }

    /* when dragging, iframe is a mess. It's because of z-index.
    Let's do something about it */

    function toggleZIndexIframe() {
        let iframe = right.querySelector('iframe')
        if(isResizing) {
            iframe.style.zIndex = -1
        } else {
            iframe.style.zIndex = 0
        }
    }

    handle.addEventListener('mousedown', function (e) {
        isResizing = true;
        lastDownX = e.clientX;
    });

    window.addEventListener('mousemove', function (e) {
        // we don't want to do anything if we aren't resizing.
        if (isResizing) 
            doResize(e)
    })
    
    window.addEventListener('mouseup', function (e) {
        // stop resizing
        isResizing = false;

        toggleZIndexIframe()
    });

    function doResize(event) {
        clientX = event.clientX
        var offsetRight = container.offsetWidth - (clientX - offset(container).left);

        left.style.right = offsetRight + 'px'
        right.style.width = offsetRight + 'px'

        toggleZIndexIframe()
        updateTabLinksSize()
    }


    function offset(element) {
        var rect = element.getBoundingClientRect();

        return { 
            top: rect.top + window.pageYOffset, 
            left: rect.left + window.pageYOffset, 
        };
    }

}
