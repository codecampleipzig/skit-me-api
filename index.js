const Koa = require("koa");
const KoaRouter = require("koa-router");
const socketIo = require("socket.io");
const cors = require("@koa/cors");
const { v4: uuidv4 } = require("uuid");
const Room = require("./Room");
const Player = require("./Player");

/* Configuration */
const PORT = process.env.PORT || 1234;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:8080";
/* Configuration End */

const rooms = {};

const app = new Koa();

const router = new KoaRouter();
router.post("/rooms", (ctx) => {
  // generate random unique room id with uuidv4
  const roomId = uuidv4();
  // create empty room for roomId
  rooms[roomId] = new Room(roomId);
  // send generated room id to player so that he/she can reenter the room
  ctx.body = {
    roomId,
  };
});

// install router to app
app.use(cors());
app.use(router.routes()).use(router.allowedMethods());

const server = app.listen(PORT, () => console.log(`running on port ${PORT}`));
const io = socketIo(server, {
  origins: FRONTEND_URL,
});
io.origins((origin, callback) => {
  callback(null, true);
});

io.on("connection", (socket) => {
  console.log("a player connected");
  /** @type {Room} */
  let myRoom = null;
  /** @type {Player} */
  let myPlayer = null;

  socket.on("joinRoom", ({ userName, roomId }, respond) => {
    // player wants to join but is already in a room
    if (myRoom) {
      respond({
        error: "already connected",
      });
    }

    myRoom = rooms[roomId];

    if (myRoom) {
      socket.join(roomId, () => {
        myPlayer = new Player(userName, socket);

        if (myRoom.addPlayer(myPlayer)) {
          respond({
            room: myRoom.getRoomInfo(),
            playerId: myPlayer.getId(),
          });
          socket.to(myRoom.getId()).emit("roomUpdate", myRoom.getRoomInfo());
        } else {
          respond({
            error: "The room has already the maximum number of players in it!",
          });
        }
      });
    } else {
      respond({
        error: "room does not exist",
      });
    }
  });

  socket.on("signalReady", () => {
    myPlayer.setReadyStatus();
    io.to(myRoom.getId()).emit("roomUpdate", myRoom.getRoomInfo());

    if (myRoom.isEveryoneReady()) {
      /** @type {Game} */
      const game = myRoom.getGame();

      for (const player of myRoom.players) {
        const sheetId = game.createSheet();
        player.socket.emit("startSeed", sheetId);
      }
    }
  });
  
  socket.on("completeWriting", (content, sheetId) => {
    const game = myRoom.getGame();
    const nextPhaseReady = game.addWriting(sheetId, content, myPlayer);

    if (nextPhaseReady) {
      if (game.isGameEnding()) {
        io.to(myRoom.roomId).emit("endGame", "DONE", myRoom.game.sheets);
      } else {
        goToPhase("startDrawing", sheetId);
      }
    }
  });

  socket.on("completeDrawing", (content, sheetId) => {
    const game = myRoom.getGame();
    const nextPhaseReady = game.addDrawing(sheetId, content, myPlayer);

    if (nextPhaseReady) {
      if (game.isGameEnding()) {
        io.to(myRoom.roomId).emit("endGame", "DONE", myRoom.game.sheets);
      } else {
        goToPhase("startWriting", sheetId);
      }
    }
  });

  function goToPhase(phaseStartEvent, sheetId) {
    const players = myRoom.getPlayers();
    const game = myRoom.getGame();

    for (let i = 0; i < players.length; i += 1) {
      const thisPlayer = players[i];
      // find Sheet of player i
      const resultOfPlayer = game.stage.results.find(
        (result) => result.player.id == thisPlayer.id
      );

      // find player to send that sheet to
      const playerToSendResultTo =
        myRoom.players[i == myRoom.players.length - 1 ? 0 : i + 1];
      // send to sheet
      playerToSendResultTo.socket.emit(
        phaseStartEvent,
        resultOfPlayer.content,
        resultOfPlayer.sheetId,

        console.log(resultOfPlayer.sheetId, "playerToSendResultTo")
      );
    }
  }

  socket.on("disconnect", () => {
    if (myPlayer) {
      myPlayer.connected = false;
      myPlayer.socket = null;
      if (!myRoom.players.some((player) => player.connected)) {
        delete rooms[myRoom.roomId];
        console.log(Object.keys(rooms).length);
        return;
      }
      socket.to(myRoom.roomId).emit("roomUpdate", myRoom.getRoomInfo());
    }
  });
});
