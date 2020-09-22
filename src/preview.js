import mevent from './lib/mevent.js';
import draggable from './lib/draggable.js';

export default function(element) {
    let header = element.querySelector('header') || false;

    let maxButton = header.querySelector('span:nth-of-type(2)'),
    minButton = header.querySelector('span:nth-of-type(3)'),
    closeButton = header.querySelector('span:nth-of-type(1)'),
    enableButton = document.getElementById('enable-preview');

    maxButton.onclick = max;
    minButton.onclick = min;
    closeButton.onclick = close;
    enableButton.onclick = open;
   
    if(header) {
        configPlugin()
    }

    function configPlugin() {
        // Make the DIV element draggable:
        draggable(element);

        mevent.trigger('floatWindowLoaded');
    }

    function max(){
        open()

        element.style.right = 'unset';

        element.style.width = "90vw";
        element.style.height = "85vh";

        element.style.left = "50%";
        element.style.top = " 6%";

        element.style.transform ="translateX(-50%)";

        mevent.trigger('floatWindowMax');
    }
    function min(){
        open()

        element.style.left = 'unset';

        element.style.width = "min(30%, 600px)";
        element.style.height = " min(30vw, 400px)";

        element.style.right = "2%";
        element.style.top = "6%";

        element.style.transform = "translateX(0)";

        mevent.trigger('floatWindowMin');
    }
    function close(){
        element.style.display = 'none';
        enableButton.style.display = 'initial';

        mevent.trigger('floatWindowClose');
    }

    function open(){
        element.style.transitionProperty = 'width, height';
        element.style.transitionDuration = '.2s';

        enableButton.style.display = 'none';
        element.style.display = 'initial';

        mevent.trigger('floatWindowOpen');
    }

    // to speed up css resize. without it, all things became slower
    element.ontransitionend = () => {
        element.style.transitionProperty = '';
        element.style.transitionDuration = '0s';
    }

}