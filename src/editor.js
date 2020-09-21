export default function () {

    const renderedEditors = []

    const editors = {
        html: (options) => CodeMirror.fromTextArea(document.getElementById("editor-html"), {
            mode:  { name: "htmlmixed" },
            ...options
        }),
        css: (options) => CodeMirror.fromTextArea(document.getElementById("editor-css"), {
            mode:  { name: "css" },
            ...options
        }),
        js: (options) => CodeMirror.fromTextArea(document.getElementById("editor-js"), {
            mode:  { name: "javascript" },
            ...options
        })
    }

    Object.keys(editors).forEach(id => {
        const options = {
            lineNumbers: true,
            lineWrapping: true,
            theme :'dracula',
            extraKeys : {
                "Ctrl-Space": "autocomplete",
                'Tab': 'emmetExpandAbbreviation',
                'Esc': 'emmetResetAbbreviation',
                'Enter': 'emmetInsertLineBreak',
                'Cmd-/': 'emmetToggleComment',
                'Ctrl-/': 'emmetToggleComment',
            }
        };

        const editor = editors[id](options)

        editor.on('keyup', debounceEvent(handleKeyup))

        renderedEditors.push({
            id,
            editor
        })
    })

    const codes = value => ({
        html: value,
        css: `<style>${value}</style>`,
        js: `<script>${value}</script>`
    })

    function addCodeToIframe(code) {
        console.log(code)
        const data_url = "data:text/html;charset=utf-8;base64," + window.btoa(code);
        document.getElementById("result").src = data_url; 
    }   

    function submit_html()
    {
        let editorValue = ''
        renderedEditors.forEach(({id, editor}) => {
            console.log(id)
            editor.save()

            let value = document.getElementById(`editor-${id}`).value;
            
            value ? editorValue += codes(value)[id] : ''
        })

        addCodeToIframe(editorValue)
        editorValue = ''
    }

    function debounceEvent(fn, wait = 1000, time) {
        return (...args) => clearTimeout(time, time = setTimeout(() => fn(...args), wait))
    } 

    function handleKeyup(event) {
        submit_html()
    }
}