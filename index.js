'use strict';
const koa = require('koa')
const koaRouter = require('koa-router')
const socketIo = require('socket.io')


const app = new koa()
const router = new koaRouter()



router.get('koala', '/', (ctx) => {
  ctx.body = "Welcome! To the Koala Book of Everything!"
})

app.use(router.routes())
  .use(router.allowedMethods())

const server = app.listen(1234, () => console.log('running on port 1234'));
const io = socketIo(server)
io.on('connection', (socket) => {
  socket.on("hello", (data)=>{
    console.log(data);
    socket.emit("hello back","hello from server")
    console.log("sent hello from server")
  })
  socket.on('disconnect',()=>{
    console.log("a user disconnected")
  })
  console.log('a user connected');
});
