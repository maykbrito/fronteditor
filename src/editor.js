export default function () {

    const renderedEditors = []

    const configEditor = name => options => 
    CodeMirror.fromTextArea(document.getElementById(`editor-${name}`), {
        mode:  { name },
        ...options
    })

    const editors = {
        htmlmixed: configEditor("htmlmixed"),
        css: configEditor("css"),
        javascript: configEditor("javascript"),
        markdown: configEditor("markdown"),
    }

    Object.keys(editors).forEach(id => {
        const options = {
            lineNumbers: true,
            lineWrapping: true,
            theme: id !== 'markdown' ? 'dracula' : 'default',
            foldGutter: true,
            gutters: ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
            extraKeys : {
                "Ctrl-Space": "autocomplete",
                'Tab': 'emmetExpandAbbreviation',
                'Esc': 'emmetResetAbbreviation',
                'Enter': 'emmetInsertLineBreak',
                'Cmd-/': 'emmetToggleComment',
                'Ctrl-/': 'emmetToggleComment',
                "Ctrl-Q": function(cm){
                    cm.foldCode(cm.getCursor());
                }
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
        htmlmixed: value,
        css: `<style>${value}</style>`,
        javascript: `<script>${value}</script>`,
        markdown: ''
    })

    function addCodeToIframe(code) {
        const data_url = "data:text/html;charset=utf-8;base64," + window.btoa(code);
        document.getElementById("result").src = data_url; 
    }   

    function submit_html()
    {
        let editorValue = ''
        renderedEditors.forEach(({id, editor}) => {
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