/*
 * This script adds cross-document messaging (postMessage) support [1,2], to allow
 * embedding one or many instances of the Tree Illustrator UI in an
 * IPython notebook. This lets us provide tree data from the surrounding
 * IPython session, and save SVG output or complete illustration JSON from each
 * instance.
 *
 * This should be useful in pre-publication and exploratory scenarios for a
 * single user, or fairly easy collaboration, using Wakari or another notebook
 * server.
 *
 * [1] https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
 * [2] http://caniuse.com/#search=postMessage
 */

// TODO: set expected calling domain when instance is created?

function receiveMessage(msg) {
    /* REMINDER: A message has three properties of interest:
     *   msg.origin is the domain that holds the surrounding IPython notebook
     *   msg.data is its payload
     *   msg.source is the window that sent the message (the notebook viewer)
     */
    if (msg.source !== window.opener) {
        alert("Expected this message from my window.opener!");
        //return;
    }

    if (!msg.data['method']) {
        alert("Expected a named method in msg.data.method!");
        return;
    }

    switch(msg.data['method']) {
        case '':
            break;
        default:
            alert("Unxpected method ["+ msg.data.method +"] in this message!");
            return;
    }

    // send a reply to the calling window
    msg.source.postMessage("HI MOM", msg.origin);
}

window.addEventListener("message", receiveMessage, false);

