const { v4: uuidv4 } = require("uuid");

class Game {
  constructor( playersCount ) {
    this.sheets = {};
    this.playersCount = playersCount;
    this.phaseCount = 0;
    this.gameEnd = false;
  }

  createSheet() {
    const sheetId = uuidv4();
    this.sheets[sheetId] = [];

    return sheetId;
  }

  addWriting(sheetId, content, player) {
    this.addContent("writing", sheetId, content, player);
  }

  addDrawing(sheetId, content, player) {
    this.addContent("drawing", sheetId, content, player);
  }

  addContent(type, sheetId, content, player) {
    this.sheets[sheetId].push({
      type: type,
      content: content,
      player: player.getUsername(),
      playerId: player.getId(),
    })

    if (this.phaseCount < this.sheets[sheetId].length) {
      this.phaseCount++;
    }

    return this.tryEnterNextPhase();
  }

  getSheets() {
    return this.sheets;
  }

  getSheet(sheetId) {
    return this.sheets[sheetId];
  }

  isNextStageReady() {
    return Object.values(this.sheets).every( 
      sheet => sheet.length === this.phaseCount,
    )
  }

  tryEnterNextPhase() {
    if (this.isNextStageReady()) {
      if (this.phaseCount === this.playersCount) {
        this.gameEnd = true;
      }

      return true;
    }

    return false;
  }

  isGameEnding() {
    return this.gameEnd;
  }
}

module.exports = Game;
