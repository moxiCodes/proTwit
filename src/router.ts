import { Router } from "express";
import * as handlers from "./handlers";
import { checkAuth } from "./modules/auth";
import { body } from "express-validator";
const router = Router();

//USERS
router.get("/users", handlers.getAllUsers);
router.get("/user/key", checkAuth, handlers.requestNewKey);
router.post("/user", handlers.createUser);
router.patch("/user", checkAuth, handlers.updateUser);

//POSTS
router.get("/posts", checkAuth, handlers.getAllPosts);
router.get("/posts/filter", checkAuth, handlers.getPostByFilters);
router.get("/posts/:userId", checkAuth, handlers.getPostsByUser);

router.post(
	"/posts",
	checkAuth,
	body(["message", "name"]).trim().isString(),
	handlers.createPost
);
router.patch("/post", checkAuth, handlers.updatePost);
export default router;
