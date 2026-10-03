jest.mock("../src/config/redis", () => {
  const Redis = require("ioredis-mock");
  return new Redis();
});
jest.mock("../src/models/SecurityEvent", () => ({
  create: jest.fn().mockResolvedValue({}),
}));
jest.mock("../src/models/Project", () => ({
  find: jest.fn(),
}));
jest.mock("../src/models/Post", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
}));

const request = require("supertest");
const redis = require("../src/config/redis");
const Project = require("../src/models/Project");
const Post = require("../src/models/Post");
const { createApp } = require("../src/app");

const app = createApp();

function queryReturning(value) {
  const query = {
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(value),
  };
  return query;
}

beforeEach(async () => {
  jest.clearAllMocks();
  await redis.flushall();
});

test("public project listing applies category filter and returns cached-list contract", async () => {
  const projects = [
    {
      _id: "project-1",
      title: "Threat Intelligence Board",
      category: "automation",
    },
  ];
  const query = queryReturning(projects);
  Project.find.mockReturnValue(query);

  const response = await request(app).get("/api/projects?category=automation");

  expect(response.status).toBe(200);
  expect(response.body).toEqual({ items: projects });
  expect(response.headers["cache-control"]).toBe("public, max-age=60");
  expect(Project.find).toHaveBeenCalledWith({ category: "automation" });
  expect(query.select).toHaveBeenCalledWith("-__v");
  expect(query.sort).toHaveBeenCalledWith({ order: 1, createdAt: -1 });
});

test("public post pagination only queries published content and omits article bodies", async () => {
  const posts = [
    {
      _id: "post-11",
      title: "A published investigation",
      slug: "published-investigation",
    },
  ];
  const query = queryReturning(posts);
  Post.find.mockReturnValue(query);
  Post.countDocuments.mockResolvedValue(13);

  const response = await request(app).get(
    "/api/posts?category=incident-report&page=2",
  );

  expect(response.status).toBe(200);
  expect(response.body).toEqual({
    items: posts,
    total: 13,
    page: 2,
    pages: 2,
  });
  expect(Post.find).toHaveBeenCalledWith({
    published: true,
    category: "incident-report",
  });
  expect(Post.countDocuments).toHaveBeenCalledWith({
    published: true,
    category: "incident-report",
  });
  expect(query.select).toHaveBeenCalledWith("-content -__v");
  expect(query.skip).toHaveBeenCalledWith(10);
  expect(query.limit).toHaveBeenCalledWith(10);
});

test("public post detail requires publication and returns a not-found response otherwise", async () => {
  const post = {
    _id: "post-1",
    title: "Published report",
    slug: "published-report",
    published: true,
  };
  Post.findOne
    .mockReturnValueOnce(queryReturning(post))
    .mockReturnValueOnce(queryReturning(null));

  const published = await request(app).get("/api/posts/published-report");
  const missing = await request(app).get("/api/posts/unpublished-report");

  expect(published.status).toBe(200);
  expect(published.body).toEqual(post);
  expect(published.headers["cache-control"]).toBe("public, max-age=60");
  expect(missing.status).toBe(404);
  expect(missing.body.error.code).toBe("NOT_FOUND");
  expect(Post.findOne).toHaveBeenNthCalledWith(1, {
    slug: "published-report",
    published: true,
  });
  expect(Post.findOne).toHaveBeenNthCalledWith(2, {
    slug: "unpublished-report",
    published: true,
  });
});

test("missing post slugs return not found without caching the miss", async () => {
  Post.findOne.mockReturnValue(queryReturning(null));

  const first = await request(app).get("/api/posts/not-published");
  const second = await request(app).get("/api/posts/not-published");

  expect(first.status).toBe(404);
  expect(second.status).toBe(404);
  expect(first.body.error.code).toBe("NOT_FOUND");
  expect(Post.findOne).toHaveBeenCalledTimes(2);
});

test("empty projects and post pages keep response shapes and do not cache empty post results", async () => {
  Project.find.mockReturnValue(queryReturning([]));
  Post.find.mockReturnValue(queryReturning([]));
  Post.countDocuments.mockResolvedValue(0);

  const projects = await request(app).get("/api/projects");
  const firstPosts = await request(app).get("/api/posts?tag=missing-tag");
  const secondPosts = await request(app).get("/api/posts?tag=missing-tag");

  expect(projects.status).toBe(200);
  expect(projects.body).toEqual({ items: [] });
  expect(firstPosts.status).toBe(200);
  expect(firstPosts.body).toEqual({
    items: [],
    total: 0,
    page: 1,
    pages: 0,
  });
  expect(secondPosts.body).toEqual(firstPosts.body);
  expect(Project.find).toHaveBeenCalledTimes(1);
  expect(Post.find).toHaveBeenCalledTimes(2);
  expect(Post.countDocuments).toHaveBeenCalledTimes(2);
});

test("free-text post searches are not cached and use a text-search filter", async () => {
  const query = queryReturning([]);
  Post.find.mockReturnValue(query);
  Post.countDocuments.mockResolvedValue(0);

  const first = await request(app).get("/api/posts?q=security+investigation");
  const second = await request(app).get("/api/posts?q=security+investigation");

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(first.body).toMatchObject({ items: [], total: 0, page: 1, pages: 0 });
  expect(Post.find).toHaveBeenCalledTimes(2);
  expect(Post.find).toHaveBeenCalledWith(
    { published: true, $text: { $search: "security investigation" } },
    { score: { $meta: "textScore" } },
  );
});
