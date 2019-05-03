const rai = require('random-access-idb')
// const hyperdrive = require('hyperdrive')
const hyperdrive = require('@jimpick/hyperdrive-hyperdb-backend')
const crypto = require('hypercore/lib/crypto')
const newId = require('monotonic-timestamp-base36')
const dumpWriters = require('../lib/dumpWriters')
const downloadZip = require('../lib/downloadZip')
const connectToGateway = require('../lib/websocketGateway')
const customAlert = require('../components/customAlert')
const toBuffer = require('to-buffer')

var nacl = require('tweetnacl')
nacl.util = require('tweetnacl-util')

const newNonce = () => nacl.randomBytes(nacl.secretbox.nonceLength)

const newBoxNonce = () => nacl.randomBytes(nacl.box.nonceLength)

const encryptSecret = (json, key) => {
  const keyUint8Array = nacl.util.decodeBase64(key)

  const nonce = newNonce()
  const messageUint8 = nacl.util.decodeUTF8(JSON.stringify(json))
  const box = nacl.secretbox(messageUint8, nonce, keyUint8Array)

  const fullMessage = new Uint8Array(nonce.length + box.length)
  fullMessage.set(nonce)
  fullMessage.set(box, nonce.length)

  const base64FullMessage = nacl.util.encodeBase64(fullMessage)
  return base64FullMessage
}

const encryptBox = (json, theirPublicKey, myPrivateKey) => {
  const theirKeyUint8Array = nacl.util.decodeBase64(theirPublicKey)
  const myKeyUint8Array = nacl.util.decodeBase64(myPrivateKey)

  const nonce = newBoxNonce()
  const messageUint8 = nacl.util.decodeUTF8(JSON.stringify(json))
  const box = nacl.box(messageUint8, nonce, theirKeyUint8Array, myKeyUint8Array)

  const fullMessage = new Uint8Array(nonce.length + box.length)
  fullMessage.set(nonce)
  fullMessage.set(box, nonce.length)

  const base64FullMessage = nacl.util.encodeBase64(fullMessage)
  return base64FullMessage
}

const decryptSecret = (messageWithNonce, key) => {
  const keyUint8Array = nacl.util.decodeBase64(key)
  const messageWithNonceAsUint8Array = nacl.util.decodeBase64(messageWithNonce)
  const nonce = messageWithNonceAsUint8Array.slice(0, nacl.secretbox.nonceLength)
  const message = messageWithNonceAsUint8Array.slice(
    nacl.secretbox.nonceLength,
    messageWithNonce.length
  )

  const decrypted = nacl.secretbox.open(message, nonce, keyUint8Array)

  if (!decrypted) {
    return null
  }

  const base64DecryptedMessage = nacl.util.encodeUTF8(decrypted)
  return JSON.parse(base64DecryptedMessage)
}

const decryptBox = (messageWithNonce, theirKey, myKey) => {
  const theirKeyUint8Array = nacl.util.decodeBase64(theirKey)
  const myKeyUint8Array = nacl.util.decodeBase64(myKey)

  const messageWithNonceAsUint8Array = nacl.util.decodeBase64(messageWithNonce)
  const nonce = messageWithNonceAsUint8Array.slice(0, nacl.box.nonceLength)
  const message = messageWithNonceAsUint8Array.slice(
    nacl.box.nonceLength,
    messageWithNonce.length
  )

  const decrypted = nacl.box.open(message, nonce, theirKeyUint8Array, myKeyUint8Array)

  if (!decrypted) {
    return null
  }

  const base64DecryptedMessage = nacl.util.encodeUTF8(decrypted)
  return JSON.parse(base64DecryptedMessage)
}

const Buffer = require('buffer').Buffer

require('events').prototype._maxListeners = 100

module.exports = store

function store (state, emitter) {
  state.localKeyCopied = false
  state.writeStatusCollapsed = window.localStorage.getItem(
    'writeStatusCollapsed'
  )

  emitter.on('DOMContentLoaded', updateDoc)
  emitter.on('navigate', updateDoc)

  function updateDoc () {
    emitter.once('render', () => {
      document.body.scrollIntoView(true)
      // Do it again for mobile Safari
      setTimeout(() => document.body.scrollIntoView(true), 200)
    })
    state.error = null
    state.authorized = null
    state.shoppingList = []
    state.localKeyCopied = false
    state.docTitle = ''
    if (!state.params || !state.params.key) {
      state.archive = null
      state.key = null
      state.loading = false
      emitter.emit('render')
    } else {
      const keyHex = state.params.key
      console.log(`Loading ${keyHex}`)
      state.localFeedLength = null
      emitter.emit('fetchDocLastSync', keyHex)
      const storage = rai(`doc-${keyHex}`)
      const archive = hyperdrive(storage, keyHex)
      state.loading = true
      emitter.emit('render')
      archive.ready(() => {
        console.log('hyperdrive ready')
        console.log('Local key:', archive.db.local.key.toString('hex'))
        dumpWriters(archive)
        state.archive = archive
        state.key = archive.key
        if (state.cancelGatewayReplication) state.cancelGatewayReplication()
        state.cancelGatewayReplication = connectToGateway(
          archive, updateSyncStatus, updateConnecting
        )
        update()
        archive.db.watch(() => {
          console.log('Archive updated:', archive.key.toString('hex'))
          dumpWriters(archive)
          update()
        })
      })
    }
  }

  emitter.on('sendMessage', message => {
    if (!state.chat) {
      console.log('problem')
    }
    const archive = state.archive
    archive.readFile('/chat.enc.json', 'utf8', (err, data) => {
      if (err) { throw err }
      let sKey32 = state.chat.sKey.slice(0, 32)
      let chatData = decryptSecret(data, nacl.util.encodeBase64(sKey32))
      state.chat.data = {}
      state.chat.data.messages = JSON.parse(chatData.chat)

      let messageJson = require('../templates/chat/message.json')
      messageJson.message = message

      let key = window.localStorage.getItem('account-key')
      let secretKey = nacl.util.decodeBase64(window.localStorage.getItem('account-dKey'))
      messageJson.senderKey = key
      let messageArray = nacl.util.decodeUTF8(message)
      messageJson.signedMessage = nacl.util.encodeBase64(nacl.sign(messageArray, secretKey))
      state.chat.data.messages.push(messageJson)
      chatData = JSON.stringify(state.chat.data.messages)
      let encryptedChat = encryptSecret({ chat: chatData }, nacl.util.encodeBase64(sKey32))
      archive.writeFile(`/chat.enc.json`, encryptedChat, err => {
        if (err) {
          console.log(err)
          throw err
        } else {
          console.log('sent')
        }
      })
    })
  })

  function loadFriend (cb) {
    let archive = state.archive
    archive.readFile('/account/details.json', 'utf8', (err, contents) => {
      if (err) {
        throw err
      } else {
        console.log(contents)
        let accountInfo = JSON.parse(contents)
        let key32 = accountInfo.key32
        let friend = { key: state.params.key, key32: key32 }
        addFriendToChat(friend, cb)
      }
    })
  }

  function addFriendToChat (friend, cb) {
    let theirPublicKey = friend.key32
    let chatSecretKey = nacl.util.decodeBase64(window.localStorage.getItem(`chat-secretKey`))
    let archive = state.archive
    let message = { secretKey: nacl.util.encodeBase64(chatSecretKey) }
    var chatSKey32 = chatSecretKey.slice(0, 32)
    console.log('??????????????')
    console.log(chatSKey32)
    console.log(theirPublicKey)

    var box = encryptBox(message, theirPublicKey, nacl.util.encodeBase64(chatSKey32))
    archive.writeFile('/boxes/' + theirPublicKey + '.txt', box, err => {
      if (err) {
        throw err
      } else {
        cb()
      }
    })
  }

  function update () {
    if (state.viewing === 'chat') {
      readChat()
    } else if (state.viewing === 'account') {
      getDetails()
    } else if (state.viewing === 'adding') {
      tryAddFriend()
    } else if (state.viewing === 'add') {
      addFriend()
    }

    emitter.emit('render')
  }

  function tryAddFriend () {
    let archive = state.archive
    let chatKey = state.params.chatKey
    if (!state.added) {
      loadFriend(() => {
        state.added = true
        tryAddFriend()
      })
    } else {
      archive.readFile('/chats/' + chatKey + '.txt', 'utf8', (err, data) => {
        if (err) {
          console.log('Not updated yet!')
        } else {
          emitter.emit('pushState', '/addToChat/:' + chatKey + '/:' + data)
        }
      })
    }
  }

  function addFriend () {
    let archive = state.archive
    archive.authorize(toBuffer(state.params.writerKey, 'hex'), err => {
      if (err) {
        customAlert.show('Error while authorizing: ' + err.message)
      } else {
        emitter.emit('writeNewChatRecord', state.params.key, 'chat')
        emitter.emit('render')
      }
    })
  }

  function readChat () {
    if (!state.chat || !state.chat.loaded) {
      let archive = state.archive
      let key32 = window.localStorage.getItem('account-key32')
      let mySecretKey = nacl.util.decodeBase64(window.localStorage.getItem('account-dKey'))
      console.log('msk: ' + mySecretKey)
      archive.readFile('/settings.json', 'utf8', (err, settings) => {
        if (err) {
          console.log(err)
        } else {
          archive.readFile('/boxes/' + key32 + '.txt', 'utf8', (err, box) => {
            if (err) {
              console.log(err)
              state.chat = null
              state.chatError = 2
            } else {
              archive.readFile('.publicKey32', 'utf8', (err, publicKey) => {
                if (err) throw err
                else {
                  console.log('here!')
                  console.log('publicKey: ' + publicKey)
                  let pKeyArray = nacl.util.decodeBase64(publicKey)
                  let pKey = nacl.util.encodeBase64(pKeyArray)
                  let sKey = nacl.util.encodeBase64(mySecretKey.slice(0, 32))
                  console.log(box)
                  console.log(pKey)
                  console.log(sKey)
                  console.log(decryptBox(box, pKey, sKey))
                  let { secretKey } = decryptBox(box, pKey, sKey)
                  if (secretKey) {
                    let chat = {}
                    chat.settings = JSON.parse(settings)
                    chat.sKey = nacl.util.decodeBase64(secretKey)
                    chat.key = state.key
                    let key = state.key
                    state.chat = chat
                    state.chat.loaded = true
                    window.localStorage.setItem(`chat-secretKey`, secretKey)
                    readChat()
                  } else {
                    state.chatError = 2
                    console.log('No access!')
                  }
                }
              })
            }
          })
        }
      })
    } else {
      let archive = state.archive
      archive.db.authorized(archive.db.local.key, (err, authorized) => {
        if (err) { throw err }
        if (authorized) {
          state.authorized = true
          archive.readFile('/chat.enc.json', 'utf8', (err, data) => {
            if (err) { throw err }
            let sKey32 = state.chat.sKey.slice(0, 32)
            let chatData = decryptSecret(data, nacl.util.encodeBase64(sKey32))
            state.chat.data = {}
            state.chat.data.messages = JSON.parse(chatData.chat)
            state.loaded = true
            emitter.emit('render')
          })
        } else {
          console.log('not authorized')
          emitter.emit('render')
        }
      })
    }
  }

  emitter.on('loadChat', data => {
    let keyHex = data.keyHex
    let archive = state.archive
    archive.writeFile(`/chats/${keyHex}.txt`, archive.db.local.key, err => {
      if (err) {
        console.log('unable to write...')
      } else {
        emitter.emit('pushState', `/chat/:${keyHex}`)
        emitter.emit('render')
      }
    })
  })

  emitter.on('createChat', data => {
    const chatName = data.chatName
    let { publicKey: key, secretKey } = crypto.keyPair()
    let sKey = nacl.util.encodeBase64(secretKey)
    let dKey = nacl.util.decodeBase64(sKey)
    const keyHex = key.toString('hex')
    const storage = rai(`doc-${keyHex}`)
    const chatArchive = hyperdrive(storage, key, { secretKey })
    chatArchive.ready(() => {
      state.key = key
      state.archive = chatArchive
      let chat = {}
      chat.key = keyHex
      chat.sKey = dKey
      chat.keyEncoded = nacl.util.encodeBase64(key)

      state.chat = chat

      window.localStorage.setItem(`chat-secretKey`, nacl.util.encodeBase64(dKey))
      let key32 = window.localStorage.getItem('account-key32')
      console.log('key 32: ' + key32)

      writeDatJson(() => {
        setupChat(() => {
          let friend = { key: key, key32: key32 }
          addFriendToChat(friend, () => {
            console.log('adding friend')
            emitter.emit('writeNewChatRecord', keyHex, chatName)
            emitter.emit('render')
          })
        })
      })

      function writeDatJson (cb) {
        const json = JSON.stringify({
          url: `dat://${keyHex}/`,
          title: 'pba chat',
          description: `pba chat info`
        }, null, 2)
        chatArchive.writeFile('dat.json', json, err => {
          if (err) throw err
          cb()
        })
      }

      function setupChat (cb) {
        let chatSettings = require('../templates/chat/settings.json')
        state.chat.loaded = false
        state.chat.settings = chatSettings
        state.chat.settings.title = chatName
        state.chat.settings.color = 'blue'
        let settings = JSON.stringify(state.chat.settings)
        chatArchive.writeFile(`/settings.json`, settings, err => {
          if (err) {
          } else {
            let pSlice = dKey.slice(0, 32)
            let key32 = nacl.util.encodeBase64(nacl.box.keyPair.fromSecretKey(pSlice).publicKey)
            console.log('key32: ' + key32)
            chatArchive.writeFile(`.publicKey32`, key32, err => {
              if (err) throw err
              else {
                let startupScript = require('../templates/chat/startup.json')
                let stringScript = JSON.stringify(startupScript)
                let encryptedChat = encryptSecret({ chat: stringScript }, nacl.util.encodeBase64(dKey.slice(0, 32)))
                chatArchive.writeFile(`/chat.enc.json`, encryptedChat, err => {
                  if (err) {
                  } else {
                    cb()
                  }
                })
              }
            })
          }
        })
      }
    })
  })

  emitter.on('updateDetails', () => {
    let rawDetails = state.localDetails
    let details = JSON.stringify(rawDetails)
    let archive = state.archive
    archive.writeFile(`/account/details.json`, details, err => {
      if (err) {
        console.log(err)
      } else {
        emitter.emit('render')
      }
    })
  })

  emitter.on('getDetails', state => {
    getDetails()
  })

  function getDetails () {
    console.log('hello')
    let archive = state.archive
    if (!state.account) {
      archive.readFile('/account/keys.txt', 'utf8', (err, keyBox) => {
        if (err) {
          state.archive = null
          state.key = null
          state.loginError = 1
          console.log(err)
        } else {
          let secretBoxWithNonce = keyBox
          console.log('keyBox')
          console.log(keyBox)
          let boxKey = nacl.util.encodeBase64(nacl.hash(nacl.util.decodeUTF8(window.localStorage.getItem('password'))).slice(0, 32))
          const { key, secretKey, key32 } = decryptSecret(secretBoxWithNonce, boxKey)
          if (key && secretKey && key32) {
            console.log('hhheeeeerrrreeee')
            let account = {}
            account.keyEncoded = key
            account.key32 = key32
            account.key = state.key
            account.dKey = secretKey
            console.log('dkey: ' + account.dKey)
            state.account = account
            window.localStorage.setItem('account-key32', account.key32)
            window.localStorage.setItem('account-dKey', account.dKey)
            window.localStorage.setItem('account-key', account.key)
            setLocalDetails()
            emitter.emit('render')
          } else {
            console.log('here')
          }
        }
      })
    } else {
      setLocalDetails()
    }
  }

  function setLocalDetails () {
    let archive = state.archive
    archive.readFile('/account/details.json', 'utf8', (err, contents) => {
      if (err) {
        console.log(err)
      } else {
        let accountInfo = JSON.parse(contents)
        state.localDetails = accountInfo
        state.gettingDetails = false
        emitter.emit('render')
      }
    })
  }

  emitter.on('createAccount', password => {
    const { publicKey: key, secretKey } = crypto.keyPair()
    state.localFeedLength = null
    const keyHex = key.toString('hex')
    const storage = rai(`doc-${keyHex}`)
    const archive = hyperdrive(storage, key, { secretKey })

    archive.ready(() => {
      let account = {}
      let eKey = nacl.util.encodeBase64(secretKey)
      account.dKey = nacl.util.decodeBase64(eKey)
      console.log('dkey: ' + account.dKey)
      var key32 = nacl.box.keyPair.fromSecretKey(account.dKey.slice(0, 32)).publicKey
      
      let keyEnc = nacl.util.encodeBase64(key)
      let secretKeyEnc = nacl.util.encodeBase64(account.dKey)
      let key32Enc = nacl.util.encodeBase64(key32)
      let messageToStore = { key: keyEnc, secretKey: secretKeyEnc, key32: key32Enc }
      let boxKey = nacl.util.encodeBase64(nacl.hash(nacl.util.decodeUTF8(password)).slice(0, 32))
      let keyBox = encryptSecret(messageToStore, boxKey)

      account.key = keyHex
      account.keyEncoded = nacl.util.encodeBase64(key)
      account.key32 = nacl.util.encodeBase64(key32)
      account.sKey = secretKey
      console.log('key 32: ' + account.key32)
      window.localStorage.setItem('password', password)
      window.localStorage.setItem('account-key', account.key)
      window.localStorage.setItem('account-key32', account.key32)
      window.localStorage.setItem('account-secretKey', account.sKey)
      window.localStorage.setItem('account-dKey', nacl.util.encodeBase64(account.dKey))
      state.account = account

      writeDatJson(() => {
        writeKeys(() => {
          emitter.emit('writeNewAccountRecord', keyHex, 'Account Created')
          emitter.emit('render')
        })
      })

      function writeDatJson (cb) {
        const json = JSON.stringify({
          url: `dat://${keyHex}/`,
          title: 'pba',
          description: `pba account`
        }, null, 2)
        archive.writeFile('dat.json', json, err => {
          if (err) throw err
          cb()
        })
      }

      function writeKeys (cb) {
        archive.writeFile(`/account/keys.txt`, keyBox, err => {
          if (err) throw err
          else {
            let rawDetails = require('../templates/account/details.json')
            rawDetails.key32 = state.account.key32
            state.localDetails = rawDetails
            let details = JSON.stringify(rawDetails)
            archive.writeFile(`/account/details.json`, details, err => {
              if (err) {
              } else {
                cb()
              }
            })
          }
        })
      }
    })
  })

  function updateSyncStatus (message) {
    const {
      key,
      connectedPeers,
      localUploadLength,
      remoteUploadLength,
      localDownloadLength,
      remoteDownloadLength
    } = message
    if (state.key && key !== state.key.toString('hex')) return
    state.connected = !!connectedPeers
    state.localUploadLength = state.loading ? null : localUploadLength
    state.localDownloadLength = state.loading ? null : localDownloadLength
    if (state.key && connectedPeers) {
      state.connecting = false
      state.syncedUploadLength = remoteUploadLength
      state.syncedDownloadLength = remoteDownloadLength
      emitter.emit(
        'updateDocLastSync',
        {
          key,
          syncedUploadLength: remoteUploadLength,
          syncedDownloadLength: remoteDownloadLength
        }
      )
    }
    emitter.emit('render')
  }

  function updateConnecting (connecting) {
    state.connecting = connecting
  }

  emitter.on('toggleWriteStatusCollapsed', docName => {
    state.writeStatusCollapsed = !state.writeStatusCollapsed
    window.localStorage.setItem(
      'writeStatusCollapsed',
      state.writeStatusCollapsed
    )
    emitter.emit('render')
  })

  emitter.on('downloadZip', () => {
    console.log('Download zip')
    downloadZip(state.archive)
  })
}
