jest.mock("../src/config/redis", () => {
  const Redis = require("ioredis-mock");
  return new Redis();
});
jest.mock("../src/models/Post", () => ({
  find: jest.fn(),
}));

const request = require("supertest");
const redis = require("../src/config/redis");
const Post = require("../src/models/Post");
const { createApp } = require("../src/app");

beforeEach(async () => {
  await redis.flushall();
  Post.find.mockReturnValue({
    select() {
      return this;
    },
    sort() {
      return this;
    },
    lean: jest.fn().mockResolvedValue([
      { slug: "public-post&extra", updatedAt: new Date("2026-01-01T00:00:00Z") },
    ]),
  });
});

test("includes published posts as escaped XML locations", async () => {
  const response = await request(createApp()).get("/api/sitemap.xml");

  expect(response.status).toBe(200);
  expect(response.headers["content-type"]).toContain("application/xml");
  expect(response.headers["cache-control"]).toContain("max-age=300");
  expect(response.text).toContain(
    "https://my-portfolio-m3bc-i25ems9w5-sandip-80b8.vercel.app/blog/public-post&amp;extra",
  );
  expect(response.text).toContain("<lastmod>2026-01-01T00:00:00.000Z</lastmod>");
});
