import { randomUUID } from "crypto";
import { FastifyInstance } from "fastify";
import z from "zod";
import { prisma } from "../../lib/prisma";
import { redis } from "../../lib/redis";
import { voting } from "../../utils/voting-pub-sub";

export async function voteOnPoll(app: FastifyInstance) {
  app.post("/polls/:pollId/votes", async (request, reply) => {
    const voteOnPollBody = z.object({
      pollOptionId: z.string().uuid(),
    });

    const voteOnPollParams = z.object({
      pollId: z.string().uuid(),
    });

    const { pollOptionId } = voteOnPollBody.parse(request.body);
    const { pollId } = voteOnPollParams.parse(request.params);

    let { sessionId } = request.cookies;

    if (sessionId) {
      const userPreviousVote = await prisma.vote.findUnique({
        where: {
          sessionId_pollId: {
            pollId,
            sessionId,
          },
        },
      });

      if (userPreviousVote && userPreviousVote.pollOptionId !== pollOptionId) {
        await prisma.vote.delete({
          where: {
            id: userPreviousVote.id,
          },
        });
        const votes = await redis.zincrby(
          pollId,
          -1,
          userPreviousVote.pollOptionId
        );

        voting.publish(pollId, {
          pollOptionId: userPreviousVote.pollOptionId,
          votes: Number(votes),
        });
      }

      if (userPreviousVote && userPreviousVote.pollOptionId === pollOptionId) {
        return reply.status(400).send({
          error: "You have already voted for this option.",
        });
      }
    }

    if (!sessionId) {
      sessionId = randomUUID();
      reply.setCookie("sessionId", sessionId, {
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
        signed: true,
        httpOnly: true,
      });
    }

    await prisma.vote.create({
      data: {
        sessionId,
        pollId,
        pollOptionId,
      },
    });

    const votes = await redis.zincrby(pollId, 1, pollOptionId);

    voting.publish(pollId, {
      pollOptionId,
      votes: Number(votes),
    });

    return reply.status(201).send();
  });
}
