const { v4: uuidv4 } = require("uuid");

class Player {
  constructor(username, socket) {
    this.id = uuidv4()
    this.username = username;
    this.socket = socket;
    this.connected = true;
    this.readyStatus = false;
  }

  getId() {
    return this.id;
  }

  setReadyStatus() {
    this.readyStatus = true;
  }

  getReadyStatus() {
    return this.readyStatus;
  }

  getUsername() {
    return this.username;
  }
}

module.exports = Player;
