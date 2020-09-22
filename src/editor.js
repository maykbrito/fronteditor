import { b64EncodeUnicode, debounceEvent } from './lib/utils.js'
import Storage from './lib/storage.js'

export default function () {
    const renderedEditors = [];
    let editors = ['htmlmixed', 'css', 'javascript', 'markdown'];

    const formatCode = value => ({
        htmlmixed: value,
        css: `<style>${value}</style>`,
        javascript: `<script>${value}</script>`,
        markdown: '' /* don't display markdown value */
    })
    

    function addCodeToIframe(code) {
        const data_url = "data:text/html;charset=utf-8;base64," + b64EncodeUnicode(code);
        document.getElementById("result").src = data_url; 
    }   

    function submitHtml()
    {
        let editorValue = '' /* temp editor value */

        renderedEditors.forEach(({id, editor}) => {
            editor.save()

            let value = document.getElementById(`editor-${id}`).value;
            
            if (value) { // we has value, so, put it to storage and editor
                Storage.add(id, value)
                editorValue += formatCode(value)[id]
            } else {
                Storage.remove(id) // if editor is empty, remove from storage
            }
        })

        addCodeToIframe(editorValue)

        editorValue = '' /* clear temp editor value */
    }

    (function buildEditor() {
        const createEditor = name => options => 
        CodeMirror.fromTextArea(document.getElementById(`editor-${name}`), {
            mode:  { name },
            ...options
        })

        const configuredEditors = {
            htmlmixed: createEditor("htmlmixed"),
            css: createEditor("css"),
            javascript: createEditor("javascript"),
            markdown: createEditor("markdown"),
        }

        editors.forEach(editorName => {
            const options = {
                lineNumbers: true,
                lineWrapping: true,
                theme: editorName !== 'markdown' ? 'dracula' : 'default',
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
    
            const editor = configuredEditors[editorName](options)
    
            editor.on('keyup', debounceEvent(submitHtml))
    
            renderedEditors.push({
                id: editorName,
                editor
            })

            // if has data on storage, put it back to editor
            
            const data = Storage.get(editorName)

            if (data) {
                editor.setValue(data)
                submitHtml() 
            }
        })
    })(); // auto run
}