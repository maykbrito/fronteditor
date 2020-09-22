const add = (key, value) => localStorage.setItem(key, JSON.stringify(value))

const get = key => JSON.parse(localStorage.getItem(key))

const remove = key => localStorage.removeItem(key)

const clear = () => localStorage.clear()

export default {
    add, get, remove, clear
}