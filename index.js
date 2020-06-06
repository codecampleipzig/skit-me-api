const koa = require("koa");
const koaRouter = require("koa-router");
const socketIo = require("socket.io");
const cors = require("@koa/cors");
const { v4: uuidv4 } = require("uuid");

const app = new koa();
const router = new koaRouter();

const rooms = {};

const users = {};

router.post("/rooms", ctx => {
  // generate random unique room id with uuidv4
  const roomId = uuidv4();
  // create empty room for roomId
  rooms[roomId] = { roomId, players: [] };
  // send generated room id to player so that he/she can reenter the room
  ctx.body = {
    roomId
  };
});

// install router to app
app.use(cors());

app.use(router.routes()).use(router.allowedMethods());

const server = app.listen(1234, () => console.log("running on port 1234"));
const io = socketIo(server);

io.on("connection", socket => {
  console.log("a user connected");
  let room = null;
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
      room.players.push({
        userName,
        socketId: socket.id,
        connected: true,
        ready: false
      });

      respond({
        room
      });
      socket.to(roomId).emit("roomUpdate", room);
    });
  });

  socket.on("disconnect", () => {
    if (room) {
      const user = room.players.find(player => player.socketId == socket.id);
      user.connected = false;
      user.socketId = null;
      socket.to(room.roomId).emit("roomUpdate", room);
    }
  });
});
