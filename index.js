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

io.on("connection", (socket) => {
  console.log("a user connected");
  let room = null;
  let user = 0;
  socket.on("joinRoom", ({ userName, roomId }, respond) => {
    if (room) {
      respond({
        error: "already connected",
      });
    }
    room = rooms[roomId];
    if (!room) {
      respond({
        error: "room does not exist",
      });

      return;
    }

    socket.join(roomId, () => {
      user = {
        userName,
        socketId: socket.id,
        connected: true,
        ready: false,
      };
      room.players.push(user);

      respond({
        room,
      });
      socket.to(roomId).emit("roomUpdate", room);
    });
  });

  socket.on("signalReady", () => {
    user.ready = true;
    io.to(room.roomId).emit("roomUpdate", room);

    if (room.players.every((player) => player.ready)) {
      room.game = {
        stage: {
          name: "GameSeedPhase",
          results: [],
        },
        history: [],
      };
      io.to(room.roomId).emit("startSeed");
    }
  });
  socket.on("completeWriting", (descriptionTitle) => {
    room.game.stage.results.push({
      user,
      descriptionTitle,
    });

    if (room.game.stage.results.length == room.players.length) {
      room.game.history.push(room.game.stage);
      io.to(room.roomId).emit("startDrawing", descriptionTitle);
      room.game.stage = { name: "DrawingPhase", results: [] };
    }
  });
  socket.on("completeDrawing", (drawingURL) => {
    room.game.stage.results.push({
      user,
      drawingURL,
    });

    if (room.game.stage.results.length == room.players.length) {
      room.game.history.push(room.game.stage);
      io.to(room.roomId).emit("startWriting", drawingURL);
      room.game.stage = { name: "WritingPhase", results: [] };
    }
  });

  socket.on("disconnect", () => {
    if (user) {
      user.connected = false;
      user.socketId = null;
      socket.to(room.roomId).emit("roomUpdate", room);
    }
  });
});
