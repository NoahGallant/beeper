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
  emit('DOMTitleChange', 'Beeperig - Adding Friend')
  const input = html`<input type="text" autofocus spellcheck="false">`
  input.isSameNode = function (target) {
    return (target && target.nodeName && target.nodeName === 'INPUT')
  }

  state.viewing = 'adding'

  let key = state.params.chatKey

  return html`
    <body class=${prefix}>
      ${header(state)}
      <div class="content">
        <h2>
          Ask your friend to paste the following key in their app:
          <br/>
          ${key}.
          <br/>
          <br/>
          Once your friend joins you will be redirected to the chat!
          <br/>
          <form onsubmit=${update}>
          ${button.submit('Refresh')}
          </form>
        </h2>
      </div>
      ${customAlert.alertBox(state, emit)}
    </body>
  `
  function update () {
    emit('update')
  }
}
