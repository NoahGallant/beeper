const html = require('choo/html')
const css = require('sheetify')
const header = require('../components/header')
const button = require('../components/button')
const customAlert = require('../components/customAlert')

const prefix = css`
  :host {
    .content {
      margin: 1em;
    }
    input[type="text"] {
      width: 100%;
      font-size: 1.5rem;
    }
  }
`

module.exports = addFriendView

function addFriendView (state, emit) {
  emit('DOMTitleChange', 'Beeper - Loading local key...')

  state.viewing = 'loadLocal'

  return html`
    <body class=${prefix}>
      ${header(state)}
      <div class="content">
        <h2>
          Loading local key...
        </h2>
      </div>
      ${customAlert.alertBox(state, emit)}
    </body>
  `
}
