// Not working in this V2

export default function() {
    let 
        isResizing = false,
        lastDownX = 0,
        clientX;


    let container = document.getElementById('container'),
        left = document.getElementById('left_panel'),
        right = document.getElementById('right_panel'),
        handle = document.getElementById('drag');


    handle.addEventListener('mousedown', function (e) {
        isResizing = true;
        lastDownX = e.clientX;
        mevent.trigger('isResizing', true)
    });

    window.addEventListener('mousemove', function (e) {
        // we don't want to do anything if we aren't resizing.
        if (isResizing) 
            doResize(e)
    })
    
    window.addEventListener('mouseup', function (e) {
        // stop resizing
        isResizing = false;
        mevent.trigger('isResizing', false)
    });

    function doResize(event) {
        clientX = event.clientX
        var offsetRight = container.offsetWidth - (clientX - offset(container).left);

        left.style.right = offsetRight + 'px'
        right.style.width = offsetRight + 'px'
    }


    function offset(element) {
        var rect = element.getBoundingClientRect();

        return { 
            top: rect.top + window.pageYOffset, 
            left: rect.left + window.pageYOffset, 
        };
    }

}
