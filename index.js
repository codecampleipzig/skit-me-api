const koa = require("koa");
const koaRouter = require("koa-router");
const socketIo = require("socket.io");
const cors = require("@koa/cors");
const { v4: uuidv4 } = require("uuid");

const app = new koa();
const router = new koaRouter();

const rooms = {};
const NUM_ROUNDS = 3;

function getResultsFromHistory(history) {
  console.log(history);
  return history[0].results.map(seed => {
    let { user } = seed;
    console.log(user);
    const sheet = [];

    history.forEach(phase => {
      console.log("user", user);
      const resultForSheet = phase.results.find(
        result => result.user.socketId == user.socketId
      );
      sheet.push(
        phase.name == "DrawingPhase"
          ? {
              type: "drawing",
              drawingURL: resultForSheet.drawingURL
            }
          : {
              type: "writing",
              descriptionTitle: resultForSheet.descriptionTitle
            }
      );
      console.log("sheet", sheet);
      user = resultForSheet.nextPlayer;
    });
    return sheet;
  });
}
router.post("/rooms", ctx => {
  // generate random unique room id with uuidv4
  const roomId = uuidv4();
  // create empty room for roomId
  rooms[roomId] = { roomId, players: [], game: null };
  // send generated room id to player so that he/she can reenter the room
  ctx.body = {
    roomId
  };
});

function sanitizeRoom(room) {
  const { players, roomId } = room;
  return {
    roomId,
    players: players.map(({ userName, ready, connected }) => ({
      userName,
      ready,
      connected
    }))
  };
}

// install router to app
app.use(cors());

app.use(router.routes()).use(router.allowedMethods());

const server = app.listen(1234, () => console.log("running on port 1234"));
const io = socketIo(server);

io.on("connection", socket => {
  console.log("a user connected");
  let room = null;
  let user = null;
  socket.on("joinRoom", ({ userName, roomId }, respond) => {
    if (room) {
      respond({
        error: "already connected"
      });
    }
    room = rooms[roomId];
    if (!room) {
      respond({
        error: "room does not exist"
      });

      return;
    }

    socket.join(roomId, () => {
      user = {
        userName,
        socketId: socket.id,
        socket,
        connected: true,
        ready: false
      };
      room.players.push(user);

      respond({
        room: sanitizeRoom(room)
      });
      socket.to(roomId).emit("roomUpdate", sanitizeRoom(room));
    });
  });

  socket.on("ready", () => {
    if (!room) return;

    user.ready = true;

    io.to(room.roomId).emit("roomUpdate", sanitizeRoom(room));
    if (room.players.every(player => player.ready)) {
      room.game = {
        players: room.players.filter(player => player.connected),
        stage: {
          name: "GameSeedPhase",
          results: []
        },
        history: []
      };
      io.to(room.roomId).emit("startGame");
    }
  });

  socket.on("completeWriting", descriptionTitle => {
    room.game.stage.results.push({
      user,
      descriptionTitle
    });
    if (room.game.stage.results.length == room.game.players.length) {
      room.game.history.push(room.game.stage);

      if (room.game.history.length == NUM_ROUNDS) {
        const results = getResultsFromHistory(room.game.history);
        io.to(room.roomId).emit("endGame", results);
      } else {
        for (let i = 0; i < room.game.players.length; i += 1) {
          const player = room.game.players[i];
          const sheet = room.game.stage.results.find(
            result => result.user.socketId == player.socketId
          );
          const nextIndex = i == room.game.players.length - 1 ? 0 : i + 1;
          const nextPlayer = room.game.players[nextIndex];
          sheet.nextPlayer = nextPlayer;
          nextPlayer.socket.emit("startDrawing", sheet.descriptionTitle);
        }

        room.game.stage = {
          name: "DrawingPhase",
          results: []
        };
      }
    }
  });
  socket.on("completeDrawing", drawingURL => {
    room.game.stage.results.push({
      user,
      drawingURL
    });
    if (room.game.stage.results.length == room.game.players.length) {
      room.game.history.push(room.game.stage);

      if (room.game.history.length == NUM_ROUNDS) {
        const results = getResultsFromHistory(room.game.history);
        io.to(room.roomId).emit("endGame", results);
      } else {
        for (let i = 0; i < room.game.players.length; i += 1) {
          const player = room.game.players[i];
          const sheet = room.game.stage.results.find(
            result => result.user.socketId == player.socketId
          );
          const nextIndex = i == room.game.players.length - 1 ? 0 : i + 1;
          const nextPlayer = room.game.players[nextIndex];
          sheet.nextPlayer = nextPlayer;
          nextPlayer.socket.emit("startWriting", sheet.drawingURL);
        }

        room.game.stage = {
          name: "WritingPhase",
          results: []
        };
      }
    }
  });

  socket.on("disconnect", () => {
    if (room) {
      user.connected = false;
      user.socketId = null;
      socket.to(room.roomId).emit("roomUpdate", sanitizeRoom(room));
    }
  });
});
