import mevent from './mevent.js'

export default function(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0, isDragging = false,
    header = element.querySelector("header") || false;

    if (header) {
        // if present, the header is where you move the DIV from:
        header.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();

        isDragging = true;
        // get the mouse cursor position at startup:
        pos3 = e.clientX;
        pos4 = e.clientY;

        mevent.trigger('isDragging', true)
    }

    document.addEventListener('mousemove', doDrag)
    document.addEventListener('mouseup', event => {
        isDragging = false
        mevent.trigger('isDragging', false)
    })
 
    function doDrag(e) {
        if(!isDragging) return;

        e = e || window.event;
        e.preventDefault();

        // calculate the new cursor position:
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        // set the element's new position:
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";

    }
}