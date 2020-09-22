// each url will be a new content
const editor = editorName => location.pathname.replace("/", "") + editorName;

const add = (key, value) => localStorage.setItem(editor(key), JSON.stringify(value))

const get = key => JSON.parse(localStorage.getItem(editor(key)))

const remove = key => localStorage.removeItem(editor(key))

export default {
    add, get, remove
}