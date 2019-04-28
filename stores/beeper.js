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
    readChatOnline(() => {
      state.localFeedLength = null
      let messageJson = require('../templates/chat/message.json')
      messageJson.message = message
      messageJson.senderKey = state.key
      let messageArray = nacl.util.decodeUTF8(message)
      messageJson.signedMessage = nacl.util.encodeBase64(nacl.sign(messageArray, state.sKey))
      state.chat.data.messages.push(messageJson)
      let key = state.chat.key
      emitter.emit('fetchDocLastSync', key)

      dumpWriters(state.chat.archive)
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.cancelGatewayReplication = connectToGateway(
        state.chat.archive, updateSyncStatus, updateConnecting
      )
      let chatData = JSON.stringify(state.chat.data.messages)
      let encryptedChat = encryptSecret({ chat: chatData }, nacl.util.encodeBase64(state.chat.sKey.slice(0, 32)))
      state.chat.archive.writeFile(`/chat.enc.json`, encryptedChat, err => {
        if (err) {
          console.log(err)
          throw err
        } else {
          console.log('writing....')
          state.chat.sending = false
          state.cancelGatewayReplication()
          emitter.emit('readChat', {})
        }
      })
    })
  })

  emitter.on('loadFriend', data => {
    readChatOnline(() => {
      let keyHex = data.keyHex
      console.log(keyHex)
      state.localFeedLength = null
      emitter.emit('fetchDocLastSync', keyHex)
      const storage = rai(`doc-${keyHex}`)
      const archive = hyperdrive(storage, keyHex)
      archive.ready(() => {
        dumpWriters(archive)
        if (state.cancelGatewayReplication) state.cancelGatewayReplication()
        state.cancelGatewayReplication = connectToGateway(
          archive, updateSyncStatus, updateConnecting
        )
        archive.readFile('/account/details.json', 'utf8', (err, contents) => {
          if (err) {
            throw err
          } else {
            state.cancelGatewayReplication()
            console.log(contents)
            let accountInfo = JSON.parse(contents)
            let key32 = accountInfo.key32
            let friend = { key: keyHex, key32: key32, info: accountInfo, archive }
            if (!state.friends) { state.friends = {} }
            state.friends[keyHex] = friend
            if (data.toChat) {
              addFriendToChat(friend)
            } else {
              emitter.emit('render')
            }
          }
        })
      })
    })
  })

  function addFriendToChat (friend) {
    let theirPublicKey = friend.key32
    let message = { key: nacl.util.encodeBase64(state.chat.key), secretKey: nacl.util.encodeBase64(state.chat.sKey) }
    var chatSKey32 = state.chat.sKey.slice(0, 32)
    var box = encryptBox(message, theirPublicKey, nacl.util.encodeBase64(chatSKey32))
    dumpWriters(state.chat.archive)
    if (state.cancelGatewayReplication) state.cancelGatewayReplication()
    state.cancelGatewayReplication = connectToGateway(
      state.chat.archive, updateSyncStatus, updateConnecting
    )
    state.chat.archive.writeFile('/boxes/' + theirPublicKey + '.txt', box, err => {
      if (err) {
        throw err
      } else {
        state.cancelGatewayReplication()
        emitter.emit('render')
      }
    })
  }

  function readChatOnline (cb) {
    dumpWriters(state.chat.archive)
    if (state.cancelGatewayReplication) state.cancelGatewayReplication()
    state.cancelGatewayReplication = connectToGateway(
      state.chat.archive, updateSyncStatus, updateConnecting
    )
    state.chat.archive.readFile('/chat.enc.json', 'utf8', (err, data) => {
      if (err) { throw err }
      state.cancelGatewayReplication()
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
    if (!state.key) {
      state.chatError = 1
      return ''
    }

    console.log(`Loading ${keyHex}`)
    state.localFeedLength = null
    emitter.emit('fetchDocLastSync', keyHex)
    const storage = rai(`doc-${keyHex}`)
    const chatArchive = hyperdrive(storage, keyHex)
    state.loading = true
    emitter.emit('render')
    chatArchive.ready(() => {
      console.log('chatArchive ready')
      dumpWriters(chatArchive)
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.cancelGatewayReplication = connectToGateway(
        chatArchive, updateSyncStatus, updateConnecting
      )
      let key32 = state.key32
      chatArchive.readFile('/settings.json', 'utf8', (err, settings) => {
        if (err) {
          console.log(err)
        } else {
          chatArchive.readFile('/boxes/' + key32 + '.txt', 'utf8', (err, box) => {
            if (err) {
              state.chat = null
              state.chatError = 2
            } else {
              chatArchive.readFile('.publicKey32', 'utf8', (err, publicKey) => {
                if (err) throw err
                else {
                  let sKey = nacl.util.encodeBase64(state.sKey.slice(0, 32))
                  state.cancelGatewayReplication()
                  let { key, secretKey } = decryptBox(box, publicKey, sKey)
                  if (key && secretKey) { // This gave me 10,000 headaches to figure out. Otherwise secretKey goes through as null and a new ((local)) hyperdrive is made
                    key = nacl.util.decodeBase64(key)
                    secretKey = nacl.util.decodeBase64(secretKey)
                    const storage = rai(`doc-${keyHex}`)
                    var opts = {
                      metadata: function (name, opts) {
                        if (name === 'secret_key') return secretKey
                        return
                      },
                      content: function (name, opts) {
                        return // other storage
                      }
                    }
                    let newArchive = hyperdrive(storage, keyHex, { opts })
                    newArchive.ready(() => {
                      dumpWriters(newArchive)
                      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
                      state.cancelGatewayReplication = connectToGateway(
                        newArchive, updateSyncStatus, updateConnecting
                      )
                      if (chatArchive.writeable) {
                        state.cancelGatewayReplication()
                        state.chat = {}
                        state.chat.settings = JSON.parse(settings)
                        state.chat.archive = chatArchive
                        state.chat.key = keyHex
                        state.chat.sKey = secretKey
                        emitter.emit('render')
                      } else {
                        newArchive.authorize(state.sKey, () => {
                          console.log('authorized!')
                          state.cancelGatewayReplication()
                          state.chat = {}
                          state.chat.settings = JSON.parse(settings)
                          state.chat.archive = chatArchive
                          state.chat.key = keyHex
                          state.chat.sKey = secretKey
                          emitter.emit('render')
                        })
                      }
                    })
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
    if (!state.key) {
      state.chatError = 0
      return ''
    }

    const chatName = data.chatName

    const { publicKey: key, secretKey } = crypto.keyPair()
    const keyHex = key.toString('hex')
    const storage = rai(`doc-${keyHex}`)
    const chatArchive = hyperdrive(storage, key, { secretKey })
    chatArchive.ready(() => {
      dumpWriters(chatArchive)
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.cancelGatewayReplication = connectToGateway(
        chatArchive, updateSyncStatus, updateConnecting
      )
      let message = { key: nacl.util.encodeBase64(key), secretKey: nacl.util.encodeBase64(secretKey) }
      console.log(state.key32.length)
      var pKey = state.key32

      var chatSKey32 = secretKey.slice(0, 32)
      var chatPKey32 = nacl.util.encodeBase64(nacl.box.keyPair.fromSecretKey(chatSKey32).publicKey)

      var box1 = encryptBox(message, pKey, nacl.util.encodeBase64(chatSKey32)) // My recovery box for the chat

      console.log('1.0.0')

      let chat = {}
      chat.title = chatName
      chat.archive = chatArchive
      chat.sKey = secretKey
      chat.key = keyHex
      state.chat = chat

      writeDatJson(() => {
        writeKeys(() => {
          state.cancelGatewayReplication()
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

      function writeKeys (cb) {
        let key32 = state.key32
        chatArchive.writeFile(`/boxes/` + key32 + `.txt`, box1, err => {
          if (err) throw err
          else {
            chatArchive.writeFile('.publicKey32', chatPKey32, err => {
              if (err) throw err
              else {
                let chatSettings = require('../templates/chat/settings.json')
                state.chat.settings = chatSettings
                state.chat.settings.title = chatName
                state.chat.settings.color = 'blue'
                let settings = JSON.stringify(state.chat.settings)
                chatArchive.writeFile(`/settings.json`, settings, err => {
                  if (err) {
                  } else {
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
      }
    })
  })

  emitter.on('login', login => {
    const keyHex = login.keyHex
    console.log(`Loading ${keyHex}`)
    const storage = rai(`doc-${keyHex}`)
    const archive = hyperdrive(storage, keyHex)
    state.loading = true
    emitter.emit('render')
    archive.ready(() => {
      dumpWriters(archive)
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.cancelGatewayReplication = connectToGateway(
        archive, updateSyncStatus, updateConnecting
      )
      archive.readdir('/logins/', (err, fileList) => {
        if (err) {
          console.log(err)
        } else {
          for (var i in fileList) {
            console.log(i)
          }
        }
      })

      archive.readFile('/account/keys.txt', 'utf8', (err, keyBox) => {
        if (err) {
          state.archive = null
          state.key = null
          state.loginError = 1
          console.log(err)
        } else {
          let secretBoxWithNonce = keyBox
          let boxKey = nacl.util.encodeBase64(nacl.hash(nacl.util.decodeUTF8(login.password)).slice(0, 32))
          const { key, secretKey, key32 } = decryptSecret(secretBoxWithNonce, boxKey)
          state.cancelGatewayReplication()
          if (key && secretKey && key32) {
            const storage = rai(`doc-${keyHex}`)
            var opts = {
              metadata: function (name, opts) {
                if (name === 'secret_key') return secretKey
                return
              },
              content: function (name, opts) {
                return // other storage
              }
            }
            let newArchive = hyperdrive(storage, keyHex, opts)
            newArchive.ready(() => {
              dumpWriters(newArchive)
              if (state.cancelGatewayReplication) state.cancelGatewayReplication()
              state.cancelGatewayReplication = connectToGateway(
                newArchive, updateSyncStatus, updateConnecting
              )
              let path = `/logins/` + Date.now() + `.txt`
              let block = Buffer.from(Date.now().toString())
              newArchive.writeFile(path, block, err => {
                if (err) {
                  console.log(err)
                } else {
                  state.loggedIn = true
                  state.archive = newArchive
                  state.key = keyHex
                  state.keyEncoded = key
                  state.key32 = key32
                  state.sKey = nacl.util.decodeBase64(secretKey)
                  if (state.cancelGatewayReplication) state.cancelGatewayReplication()
                  emitter.emit('render')
                }
              })
            })
          } else {
            state.archive = null
            state.key = null
            state.loginError = 2
            console.log(err)
          }
        }
      })
    })
  })

  emitter.on('updateDetails', state => {
    let rawDetails = state.localDetails
    let details = JSON.stringify(rawDetails)
    state.archive.writeFile(`/account/details.json`, details, err => {
      if (err) throw err
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.cancelGatewayReplication = connectToGateway(
        state.archive, updateSyncStatus, updateConnecting
      )
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      emitter.emit('render')
    })
  })

  emitter.on('getDetails', state => {
    console.log('getting details...')
    if (state.cancelGatewayReplication) state.cancelGatewayReplication()
    state.cancelGatewayReplication = connectToGateway(
      state.archive, updateSyncStatus, updateConnecting
    )
    state.archive.readFile('/account/details.json', 'utf8', (err, contents) => {
      if (err) {
        console.log(err)
      } else {
        let accountInfo = JSON.parse(contents)
        state.localDetails = accountInfo
        state.gettingDetails = false
        state.cancelGatewayReplication()
        emitter.emit('render')
      }
    })
  })

  emitter.on('createAccount', password => {
    const { publicKey: key, secretKey } = crypto.keyPair()
    var secretKey32 = secretKey.slice(0, 32)
    var key32 = nacl.box.keyPair.fromSecretKey(secretKey32).publicKey

    const keyHex = key.toString('hex')
    const storage = rai(`doc-${keyHex}`)
    const archive = hyperdrive(storage, key, { secretKey })

    archive.ready(() => {
      dumpWriters(archive)
      if (state.cancelGatewayReplication) state.cancelGatewayReplication()
      state.cancelGatewayReplication = connectToGateway(
        archive, updateSyncStatus, updateConnecting
      )
      console.log('hyperdrive engaged...')
      let keyEnc = nacl.util.encodeBase64(key)
      let secretKeyEnc = nacl.util.encodeBase64(secretKey)
      let key32Enc = nacl.util.encodeBase64(key32)
      let messageToStore = { key: keyEnc, secretKey: secretKeyEnc, key32: key32Enc }

      let boxKey = nacl.util.encodeBase64(nacl.hash(nacl.util.decodeUTF8(password)).slice(0, 32))

      let keyBox = encryptSecret(messageToStore, boxKey)

      state.key = keyHex
      state.keyEncoded = nacl.util.encodeBase64(key)
      state.key32 = nacl.util.encodeBase64(key32)
      state.archive = archive
      state.sKey = secretKey
      state.loggedIn = true

      writeDatJson(() => {
        writeKeys(() => {
          state.cancelGatewayReplication()
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
            rawDetails.key32 = state.key32
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
