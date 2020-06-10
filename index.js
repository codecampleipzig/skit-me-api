const Koa = require("koa");
const KoaRouter = require("koa-router");
const socketIo = require("socket.io");
const cors = require("@koa/cors");
const { v4: uuidv4 } = require("uuid");

const PORT = process.env.PORT || 1234;

const app = new Koa();
const router = new KoaRouter();

const rooms = {};

router.post("/rooms", (ctx) => {
  // generate random unique room id with uuidv4
  const roomId = uuidv4();
  // create empty room for roomId
  rooms[roomId] = { roomId, players: [], game: null };
  // send generated room id to player so that he/she can reenter the room
  ctx.body = {
    roomId,
  };
});

// install router to app
app.use(cors());

app.use(router.routes()).use(router.allowedMethods());

const server = app.listen(PORT, () => console.log(`running on port ${PORT}`));
const io = socketIo(server);
io.origins("https://heuristic-stonebraker-43aa0c.netlify.app");

io.on("connection", (socket) => {
  console.log("a player connected");
  let room = null;
  let player = null;

  function sendEndGame() {
    console.log("endgame");
    io.to(room.roomId).emit("endGame", "DONE", room.game.sheets);
      
    // console.log("endgame1");
    // console.log(room.game.sheets);
    room.game = null;
    room.players.forEach((player) => (player.ready = false));
  }

  function getSanitizedRoom() {
    const { roomId, players } = room;
    return {
      roomId,
      players: players.map((player) => ({
        userName: player.userName,
        connected: player.connected,
        ready: player.ready,
      })),
    };
  }

  function goToPhase(phase, phaseStartEvent) {
    for (let i = 0; i < room.players.length; i += 1) {
      const thisPlayer = room.players[i];
      // find Sheet of plaxyer i
      const resultOfPlayer = room.game.stage.results.find(
        (result) => result.player.id == thisPlayer.id
      );

      // find player to send that sheet to
      const playerToSendResultTo =
        room.players[i == room.players.length - 1 ? 0 : i + 1];
      // send to sheet
      playerToSendResultTo.socket.emit(
        phaseStartEvent,
        resultOfPlayer.content,
        resultOfPlayer.sheetId,

        console.log(resultOfPlayer.sheetId, "playerToSendResultTo")
      );
    }
    room.game.stage = { name: phase, results: [] };
  }

  socket.on("joinRoom", ({ userName, roomId }, respond) => {
    // What happens here ?
    if (room) {
      respond({
        error: "already connected",
      });
    }
    room = rooms[roomId];
    // if roomId does not exist, respond with error
    if (!room) {
      respond({
        error: "room does not exist",
      });

      return;
    }

      socket.join(roomId, () => {
          if (room.players.length < 8) {
              player = {
                  id: uuidv4(),
                  userName,
                  socket,
                  connected: true,
                  ready: false,
              };
              // where is room.players ?
              room.players.push(player);

              respond({
                  room: getSanitizedRoom(),
                  playerId: player.id,
              });
              socket.to(roomId).emit("roomUpdate", getSanitizedRoom());
          } else {        
              respond({
                  error: "The room has already the maximum number of players in it!"
              })
          }
    });
  });

  socket.on("signalReady", () => {
    player.ready = true;
    io.to(room.roomId).emit("roomUpdate", getSanitizedRoom());

    if (room.players.every((player) => player.ready) && room.players.length > 1 ) {
      room.game = {
        stage: {
          name: "GameSeedPhase",
          results: [],
        },
        history: [],
        sheets: {},
      };
      for (const player of room.players) {
        const sheetId = uuidv4();
        room.game.sheets[sheetId] = [];
        player.socket.emit("startSeed", sheetId);
        console.log(sheetId, "test2");
      }
    }
  });

  socket.on("completeWriting", (content, sheetId) => {
    room.game.stage.results.push({
      player,
      content,
      sheetId,
    });
    console.log(sheetId, "completeWriting");
    room.game.sheets[sheetId].push({
      type: "writing",
      content,
      player: player.userName,
      playerId: player.id,
    });
    console.log(room.game.sheets);

    if (room.game.stage.results.length == room.players.length) {
      room.game.history.push(room.game.stage);

      if (room.game.history.length == room.players.length) {
        sendEndGame();
      } else {
        goToPhase("DrawingPhase", "startDrawing", sheetId);
      }
    }
  });

  socket.on("completeDrawing", (content, sheetId) => {
    room.game.stage.results.push({
      player,
      content,
      sheetId,
    });

    console.log(sheetId, "completeDrawing");

    room.game.sheets[sheetId].push({
      type: "drawing",
      content,
        player: player.userName,
       playerId: player.id,
    });

    if (room.game.stage.results.length == room.players.length) {
      room.game.history.push(room.game.stage);
      if (room.game.history.length == room.players.length) {
        sendEndGame();
      } else {
        goToPhase("WritingPhase", "startWriting", sheetId);
      }
    }
  });

  socket.on("disconnect", () => {
    if (player) {
      player.connected = false;
      player.socket = null;
      if (!room.players.some(player => player.connected)) {
            delete rooms[room.roomId];
            console.log(Object.keys(rooms).length); 
            return;
        }
      socket.to(room.roomId).emit("roomUpdate", getSanitizedRoom());
    }
  });
});
