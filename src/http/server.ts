import fastifyCookie from "@fastify/cookie";
import websocket from "@fastify/websocket";
import fastify from "fastify";
import { createPoll } from "./routes/create-poll";
import { getPoll } from "./routes/get-poll";
import { voteOnPoll } from "./routes/vote-on-poll";
import { pollResults } from "./ws/poll-results";

const app = fastify();

app.register(websocket);

app.register(fastifyCookie, {
  secret: "hellodarknessmyoldfriend",
  hook: "onRequest",
});

app.register(createPoll);
app.register(getPoll);
app.register(voteOnPoll);
app.register(pollResults);

app.listen({ port: 3333 }).then(() => {
  console.log("Server running on port 3333!");
});
