const Game = require("./Game");

class Room {
  constructor(id, players = [], game = null) {
    this.id = id;
    this.players = players;
    this.game = game;
  }

  getId() {
    return this.id;
  }

  getRoomInfo() {
    return {
      roomId: this.id,
      players: this.players.map((player) => ({
        userName: player.userName,
        connected: player.connected,
        ready: player.ready,
      })),
    };
  }

  getGame() {
    if (!this.game) {
      this.game = new Game();
    }

    return this.game;
  }

  getPlayers() {
    return this.players;
  }

  addPlayer(player) {
    if (this.players.length < 8) {
      this.players.push(player);
      return true;
    } else {
      return false;
    }
  }

  isEveryoneReady() {
    return this.players.length > 1 &&
      this.players.every((player) => player.getReadyStatus());
  }
}

module.exports = Room;
