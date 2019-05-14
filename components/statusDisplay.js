const html = require('choo/html')

module.exports = statusDisplay

function statusDisplay (state) {
  if (!state) return null
  let connected

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
    return html`${connected}`
  }
  if (state.networkStatus !== undefined) {
    const onlineOffline = state.networkStatus
      ? html`<span class="online">online</span>`
      : html`<span class="offline">offline</span>`
    return onlineOffline
  }
}
