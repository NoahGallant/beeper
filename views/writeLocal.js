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

module.exports = writeLocalView

function writeLocalView (state, emit) {
  emit('DOMTitleChange', 'Beeper - Adding Friend')

  state.viewing = 'writeLocal'

  return html`
    <body class=${prefix}>
      ${header(state)}
      <div class="content">
        <h2>
          Writing local key...
        </h2>
      </div>
      ${customAlert.alertBox(state, emit)}
    </body>
  `
}
