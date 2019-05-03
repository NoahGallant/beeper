const choo = require('choo')
const chooServiceWorker = require('choo-service-worker')
const css = require('sheetify')

const networkStatusStore = require('./stores/networkStatus')
const documentsStore = require('./stores/documents')
const beeperStore = require('./stores/beeper')

const mainView = require('./views/main')
const accountView = require('./views/account')
const chatView = require('./views/chat')
const addFriendView = require('./views/addFriend')
const addToChatView = require('./views/addToChat')

css('./index.css')

const app = choo()

// app.use(require('choo-service-worker/clear')())
app.use(chooServiceWorker())
app.use((state, emitter) => {
  emitter.on('sw:installed', () => { console.log('sw:installed') })
  emitter.on('sw:updated', () => { console.log('sw:updated') })
  emitter.on('sw:redundant', () => { console.log('sw:redundant') })
  if (navigator.serviceWorker) {
    console.log('Service worker controller', navigator.serviceWorker.controller)
    navigator.serviceWorker.getRegistrations()
      .then(registrations => {
        console.log('Service worker registrations', registrations)
      })
    navigator.serviceWorker.ready.then(serviceWorker => {
      console.log('Service worker ready', serviceWorker)
      state.serviceWorker = true
    })
  }
})

app.use(state => {
  state.devMode = false
  state.devLabel = 'f'
})

app.use(networkStatusStore)
app.use(documentsStore)
app.use(beeperStore)

app.route('/', mainView)
app.route('/account/:key', accountView)
app.route('/chat/:key', chatView)
app.route('/addFriendToChat/:key/:chatKey', addFriendView)
app.route('/addToChat/:key/:writerKey', addToChatView)

app.mount('body')
