import mevent from './lib/mevent.js';

export default function() {

    const $ = document.querySelector.bind(document)

    const html = {
        links: document.querySelectorAll('.tab-links button'),
        contents: [...$('.tab-contents').children],
        openTab: $('.tab-links [data-open]')
    }

    function hideAllTabContents(){
        html.contents.forEach(section => {
            section.style.display = "none"
        })
    }

    function removeAllActiveClass(){
        html.links.forEach(tab => tab.classList.remove('active'))
    }

    function showCurrentTab(id){
        
        hideAllTabContents()
        
        const tabContent = $('#' + id)
        tabContent.style.display = 'block'

    }

    function selectTab(event){
        const target = event.currentTarget
        showCurrentTab(target.dataset.id)

        removeAllActiveClass()
        target.classList.add('active')

        mevent.trigger('selectedTag', target.dataset.id)
    }

    function handleChange(){
        html.links.forEach(tab => {
            tab.addEventListener('click', selectTab)
        })
    }

    function init() {
        hideAllTabContents()
        handleChange()

        html.openTab.click()
    }

    init()
}