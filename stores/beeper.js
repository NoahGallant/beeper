const rai = require('random-access-idb')
// const hyperdrive = require('hyperdrive')
const hyperdrive = require('@jimpick/hyperdrive-hyperdb-backend')
const crypto = require('hypercore/lib/crypto')
const newId = require('monotonic-timestamp-base36')
const dumpWriters = require('../lib/dumpWriters')
const downloadZip = require('../lib/downloadZip')
const connectToGateway = require('../lib/websocketGateway')
const customAlert = require('../components/customAlert')

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
  state.writeStatusCollapsed = window.localStorage.getItem(
    'writeStatusCollapsed'
  )

  emitter.on('sendMessage', message => {
    if (!state.chat) {
      console.log('problem')
    }
    if (state.cancelGatewayReplication) state.cancelGatewayReplication()
    state.key = state.chat.key
    state.archive = state.chat.archive
    state.cancelGatewayReplication = connectToGateway(
      state.archive, updateSyncStatus, updateConnecting
    )

    let messageJson = require('../templates/chat/message.json')
    messageJson.message = message
    messageJson.senderKey = state.account.key
    let messageArray = nacl.util.decodeUTF8(message)
    messageJson.signedMessage = nacl.util.encodeBase64(nacl.sign(messageArray, state.account.sKey))
    state.chat.data.messages.push(messageJson)
    let chatData = JSON.stringify(state.chat.data.messages)
    let encryptedChat = encryptSecret({ chat: chatData }, nacl.util.encodeBase64(state.chat.sKey.slice(0, 32)))
    state.chat.archive.writeFile(`/chat.enc.json`, encryptedChat, err => {
      if (err) {
        console.log(err)
        throw err
      } else {
        emitter.emit('readChat', {})
      }
    })
  })

  emitter.on('loadFriend', data => {
    let keyHex = data.keyHex
    console.log(keyHex)
    state.localFeedLength = null
    emitter.emit('fetchDocLastSync', keyHex)
    const storage = rai(`doc-${keyHex}`)
    const archive = hyperdrive(storage, keyHex)
    archive.ready(() => {
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.key = keyHex
      state.archive = archive
      state.cancelGatewayReplication = connectToGateway(
        archive, updateSyncStatus, updateConnecting
      )
      archive.readFile('/account/details.json', 'utf8', (err, contents) => {
        if (err) {
          throw err
        } else {
          console.log(contents)
          let accountInfo = JSON.parse(contents)
          let key32 = accountInfo.key32
          let friend = { key: keyHex, key32: key32, info: accountInfo, archive }
          if (!state.friends) { state.friends = {} }
          state.friends[keyHex] = friend
          if (data.toChat) {
            addFriendToChat(friend)
          } else {
            if (state.cancelGatewayReplication) state.cancelGatewayReplication()
            state.archive = state.chat.archive
            state.key = state.chat.archive.key
            state.cancelGatewayReplication = connectToGateway(
              state.chat.archive, updateSyncStatus, updateConnecting
            )
            emitter.emit('render')
          }
        }
      })
    })
  })

  function addFriendToChat (friend) {
    let theirPublicKey = friend.key32
    const { publicKey: key, secretKey } = crypto.keyPair()
    state.chat.archive.authorize(secretKey, err => {
      if (err) { throw err }
      let message = { key: nacl.util.encodeBase64(key), secretKey: nacl.util.encodeBase64(secretKey) }
      var chatSKey32 = state.chat.sKey.slice(0, 32)
      var box = encryptBox(message, theirPublicKey, nacl.util.encodeBase64(chatSKey32))
      state.chat.archive.writeFile('/boxes/' + theirPublicKey + '.txt', box, err => {
        if (err) {
          throw err
        } else {
          if (state.cancelGatewayReplication) state.cancelGatewayReplication()
          state.archive = state.chat.archive
          state.key = state.chat.key
          state.cancelGatewayReplication = connectToGateway(
            state.chat.archive, updateSyncStatus, updateConnecting
          )
          emitter.emit('render')
        }
      })
    })
  }

  function readChatOnline (cb) {
    state.chat.archive.readFile('/chat.enc.json', 'utf8', (err, data) => {
      if (err) { throw err }
      console.log(state.chat)
      let sKey32 = state.chat.sKey.slice(0, 32)
      let chatData = decryptSecret(data, nacl.util.encodeBase64(sKey32))
      console.log(chatData)
      state.chat.data = {}
      state.chat.data.messages = JSON.parse(chatData.chat)
      cb()
    })
  }

  emitter.on('readChat', pass => {
    if (!state.chat || !state.chat.archive) {
      state.chatError = 3
      return
    }
    readChatOnline(() => emitter.emit('render'))
  })

  emitter.on('loadChat', data => {
    let keyHex = data.chatKey
    if (!state.account.key) {
      state.chatError = 1
      return ''
    }

    state.localFeedLength = null
    emitter.emit('fetchDocLastSync', keyHex)
    const storage = rai(`doc-${keyHex}`)
    let archive = hyperdrive(storage, keyHex)

    state.loading = true
    emitter.emit('render')
    archive.ready(() => {
      console.log('chat ready')
      state.archive = archive
      state.key = archive.key
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.cancelGatewayReplication = connectToGateway(
        archive, updateSyncStatus, updateConnecting
      )
      let key32 = state.account.key32
      archive.readFile('/settings.json', 'utf8', (err, settings) => {
        if (err) {
          console.log(err)
        } else {
          console.log('boxes...')
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
                  let sKey = nacl.util.encodeBase64(state.account.sKey.slice(0, 32))
                  let { key, secretKey } = decryptBox(box, publicKey, sKey)
                  if (key && secretKey) {
                    key = nacl.util.decodeBase64(key)
                    secretKey = nacl.util.decodeBase64(secretKey)
                    if (archive.writeable) {
                      state.chat = {}
                      state.chat.settings = JSON.parse(settings)
                      state.chat.archive = archive
                      state.chat.key = keyHex
                      state.chat.sKey = secretKey
                      emitter.emit('render')
                    } else {
                      var opts = {
                        metadata: function (name, opts) {
                          if (name === 'secret_key') return secretKey
                          if (name === 'archive') return archive
                          return
                        },
                        content: function (name, opts) {
                          return // other storage
                        }
                      }
                      state.localFeedLength = null
                      let newArchive = hyperdrive(storage, keyHex, { opts })
                      newArchive.ready(() => {
                        console.log('archive constructed')
                        state.key = newArchive.key
                        state.archive = newArchive
                        if (state.cancelGatewayReplication) state.cancelGatewayReplication()
                        state.cancelGatewayReplication = connectToGateway(
                          newArchive, updateSyncStatus, updateConnecting
                        )
                        newArchive.db.authorize(state.account.sKey, err => {
                          if (err) { throw err }
                          console.log('key authorized')
                          newArchive.db.close(err => {
                            if (err) { throw err }
                            state.key = archive.key
                            state.archive = archive
                            if (state.cancelGatewayReplication) state.cancelGatewayReplication()
                            state.cancelGatewayReplication = connectToGateway(
                              archive, updateSyncStatus, updateConnecting
                            )
                            state.chat = {}
                            state.chat.settings = JSON.parse(settings)
                            state.chat.archive = archive
                            state.chat.key = keyHex
                            state.chat.sKey = secretKey
                            emitter.emit('render')
                          })
                        })
                      })
                    }
                  } else {
                    state.chatError = 2
                    console.log('No access!')
                    emitter.emit('render')
                  }
                }
              })
            }
          })
        }
      })
    })
  })

  emitter.on('createChat', data => {
    if (!state.account.key) {
      state.chatError = 0
      return ''
    }

    const chatName = data.chatName
    const { publicKey: key, secretKey } = crypto.keyPair()
    const keyHex = key.toString('hex')
    emitter.emit('fetchDocLastSync', keyHex)
    const storage = rai(`doc-${keyHex}`)
    const chatArchive = hyperdrive(storage, key, { secretKey })
    chatArchive.ready(() => {
      dumpWriters(chatArchive)
      state.key = key
      state.archive = chatArchive
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.cancelGatewayReplication = connectToGateway(
        chatArchive, updateSyncStatus, updateConnecting
      )

      let chat = {}
      chat.title = chatName
      chat.archive = chatArchive
      chat.sKey = secretKey
      chat.key = keyHex
      state.chat = chat

      writeDatJson(() => {
        setupChat(() => {
          console.log('written')
          emitter.emit('writeNewChatRecord', keyHex, chatName)
          emitter.emit('render')
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
        state.chat.settings = chatSettings
        state.chat.settings.title = chatName
        state.chat.settings.color = 'blue'
        let settings = JSON.stringify(state.chat.settings)
        chatArchive.writeFile(`/settings.json`, settings, err => {
          if (err) {
          } else {
            let pSlice = secretKey.slice(0, 32)
            let key32 = nacl.util.encodeBase64(nacl.box.keyPair.fromSecretKey(pSlice).publicKey)
            chatArchive.writeFile(`.publicKey32`, key32, err => {
              if (err) throw err
              else {
                let startupScript = require('../templates/chat/startup.json')
                let stringScript = JSON.stringify(startupScript)
                let encryptedChat = encryptSecret({ chat: stringScript }, nacl.util.encodeBase64(secretKey.slice(0, 32)))
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

  emitter.on('updateDetails', state => {
    let rawDetails = state.localDetails
    let details = JSON.stringify(rawDetails)
    state.account.archive.writeFile(`/account/details.json`, details, err => {
      if (err) throw err
      emitter.emit('render')
    })
  })

  emitter.on('getDetails', state => {
    emitter.emit('fetchDocLastSync', state.account.key)
    state.account.archive.readFile('/account/details.json', 'utf8', (err, contents) => {
      if (err) {
        console.log(err)
      } else {
        let accountInfo = JSON.parse(contents)
        state.localDetails = accountInfo
        state.gettingDetails = false
        emitter.emit('render')
      }
    })
  })

  emitter.on('createAccount', password => {
    const { publicKey: key, secretKey } = crypto.keyPair()
    var secretKey32 = secretKey.slice(0, 32)
    var key32 = nacl.box.keyPair.fromSecretKey(secretKey32).publicKey
    state.localFeedLength = null
    const keyHex = key.toString('hex')
    const storage = rai(`doc-${keyHex}`)
    const archive = hyperdrive(storage, key, { secretKey })

    archive.ready(() => {
      dumpWriters(archive)
      state.key = key
      state.archive = archive
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.cancelGatewayReplication = connectToGateway(
        archive, updateSyncStatus, updateConnecting
      )

      let keyEnc = nacl.util.encodeBase64(key)
      let secretKeyEnc = nacl.util.encodeBase64(secretKey)
      let key32Enc = nacl.util.encodeBase64(key32)
      let messageToStore = { key: keyEnc, secretKey: secretKeyEnc, key32: key32Enc }
      let boxKey = nacl.util.encodeBase64(nacl.hash(nacl.util.decodeUTF8(password)).slice(0, 32))
      let keyBox = encryptSecret(messageToStore, boxKey)

      state.account = {}
      state.account.key = keyHex
      state.account.keyEncoded = nacl.util.encodeBase64(key)
      state.account.key32 = nacl.util.encodeBase64(key32)
      state.account.archive = archive
      state.account.sKey = secretKey
      state.account.loggedIn = true

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
