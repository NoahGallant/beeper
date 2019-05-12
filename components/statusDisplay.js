const html = require('choo/html')

module.exports = statusDisplay

function statusDisplay (state) {
  if (!state) return null
  let connected
  /*
  if (state.networkStatus !== undefined) {
    const onlineOffline = state.networkStatus
      ? html`<span class="online">Online</span>`
      : html`<span class="offline">Offline</span>`
    networkStatus = html`
      <div class="networkStatus">
        Network: ${onlineOffline}
      </div>
    `
  }
  */
  if (state.connected !== undefined) {
    if (state.connecting) {
      connected = html`
        <span class="connecting">
          connecting
        </span>
      `
    } else if (state.connected) {
      connected = html`
        <span class="online">
          online
        </span>
      `
    } else {
      if (state.networkStatus) {
        connected = html`
          <span class="offline">
            offline
          </span>
        `
      } else {
        connected = html`
          <span class="offline">
            offline
          </span>
        `
      }
    }
    connected = html`
      <div class="connected">
        ${connected}
      </div>
    `
  }

  return html`
    <div class='status'>
      ${connected}
    </div>
  `
}
