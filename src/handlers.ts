import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { User, Post, FLAGS } from "@prisma/client";
import { createToken } from "./modules/auth";
import { validationResult } from "express-validator";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

//HELPERS
const serverError = (res: Response, err: Error) => {
	console.log(err);
	return res.status(500).json("SERVER ERROR");
};
const okResponse = (res: Response, data: object | string) => {
	res.status(200).json(data);
};

//USERS
export const createUser = async (req: Request, res: Response) => {
	const { name } = req.body;
	let User: User;
	try {
		User = await prisma.user.create({
			data: {
				name: name,
			},
		});
	} catch (err) {
		const isNotUniqueUser = err.message.includes(
			"failed on the fields: (`name`)"
		);
		if (isNotUniqueUser) return res.status(401).json("USER ALREADY EXISTS");
		return serverError(res, err);
	}

	const token = createToken(User.name, User.api_key);
	return okResponse(res, { token, key: User.api_key });
};
export const updateUser = async (req: Request, res: Response) => {
	if (!req.body.auth) return res.status(401).json("NOT AUTHORIZED");
	console.log(req.body.auth);
	const { name } = req.body.auth;
	const { newName } = req.body;
	let User: User;
	try {
		User = await prisma.$transaction(async () => {
			const originalUser = await prisma.user.findUnique({
				where: { name: newName },
			});

			if (originalUser) throw new Error("USERNAME TAKEN");

			const updatedUser = await prisma.user.update({
				where: { name: name },
				data: { name: newName },
			});
			return updatedUser;
		});
	} catch (err) {
		if (err.message === "USERNAME TAKEN")
			return res.status(400).json(err.message);
		return serverError(res, err);
	}
	return okResponse(res, { User });
};
export const requestNewKey = async (req: Request, res: Response) => {
	if (!req.body.auth) return res.status(401).json("NOT AUTHORIZED");
	const { name } = req.body.auth;
	let User: User | object;
	try {
		User = await prisma.user.update({
			where: { name: name },
			data: {
				api_key: randomUUID(),
			},
			select: {
				api_key: true,
			},
		});
	} catch (err) {
		return serverError(res, err);
	}
	return okResponse(res, { User });
};
export const getAllUsers = async (req: Request, res: Response) => {
	//assuming the client is tracking offset value
	const { offset } = req.body;
	try {
		const Users = await prisma.user.findMany({
			select: {
				id: true,
				name: true,
				posts: true,
			},
			skip: offset,
			take: 10,
		});
		return okResponse(res, { Users });
	} catch (err) {
		return serverError(res, err);
	}
};

//POSTS
export const createPost = async (req: Request, res: Response) => {
	if (!req.body.auth) return res.status(401).json("NOT AUTHORIZED");

	const validationErr = validationResult(req);
	if (!validationErr.isEmpty())
		return res.status(400).json(validationErr.array());

	const { name } = req.body.auth;
	const { message, flag } = req.body;

	let Post: Post;
	let User: User;

	try {
		User = await prisma.user.findUnique({
			where: {
				name: name,
			},
		});

		Post = await prisma.post.create({
			data: {
				authorId: User.id,
				message: message,
				//assuming client is using identical flag enum values
				flag: flag,
			},
		});

		return okResponse(res, { Post });
	} catch (err) {
		return serverError(res, err);
	}
};
export const updatePost = async (req: Request, res: Response) => {
	if (!req.body.auth) return res.status(401).json("NOT AUTHORIZED");

	const { postId, userId, message } = req.body;
	let Post: Post;

	try {
		Post = await prisma.$transaction(async () => {
			const originalPost = await prisma.post.findUnique({
				where: {
					id: postId,
				},
			});
			if (originalPost.authorId !== userId)
				throw new Error("CANNOT UPDATE ANOTHER USER'S POST");
			const updatedPost = await prisma.post.update({
				where: {
					id: postId,
				},
				data: { message: message },
			});
			return updatedPost;
		});
	} catch (err) {
		if (err.message === "CANNOT UPDATE ANOTHER USER'S POST")
			return res.status(400).json(err.message);
		return serverError(res, err);
	}
	return okResponse(res, Post);
};
export const getPostsByUser = async (req: Request, res: Response) => {
	const { userId } = req.params;
	const { offset, auth } = req.body;
	let Posts: Post[];
	let User: User;
	try {
		if (auth) {
			User = await prisma.user.findUnique({
				where: {
					id: auth.name,
				},
			});
		}
		if (userId === User?.id) {
			Posts = await prisma.post.findMany({
				where: {
					authorId: userId,
					OR: [
						{ flag: FLAGS.PRIVATE, AND: { authorId: userId } },
						{ flag: FLAGS.PUBLIC },
					],
				},
				skip: offset,
				take: 5,
			});
		} else {
			Posts = await prisma.post.findMany({
				where: {
					authorId: userId,
					flag: FLAGS.PUBLIC,
				},
				skip: offset,
				take: 20,
			});
		}
	} catch (err) {
		return serverError(res, err);
	}
	return okResponse(res, { Posts });
};
export const getPostByFilters = async (req: Request, res: Response) => {
	const { userId, subString } = req.query;
	console.log(req.query);
	const { offset } = req.body;
	let Posts: Post[];
	try {
		if (userId && subString) {
			Posts = await prisma.post.findMany({
				where: {
					AND: [
						{ authorId: userId?.toString() },
						{ message: { contains: subString?.toString() } },
					],
					flag: FLAGS.PUBLIC,
				},

				skip: offset,
				take: 20,
			});
		} else {
			Posts = await prisma.post.findMany({
				where: {
					OR: [
						{ authorId: userId?.toString() },
						{ message: { contains: subString?.toString() } },
					],
					flag: FLAGS.PUBLIC,
				},
				skip: offset,
				take: 20,
			});
		}
	} catch (err) {
		return serverError(res, err);
	}

	return okResponse(res, { Posts });
};
export const getAllPosts = async (req: Request, res: Response) => {
	//assuming the client is tracking offset value
	const { offset, auth } = req.body;

	let Posts: Post[];
	let User: User;
	try {
		if (auth) {
			User = await prisma.user.findUnique({
				where: {
					name: auth.name,
				},
			});

			Posts = await prisma.post.findMany({
				where: {
					OR: [
						{ flag: FLAGS.PRIVATE, AND: { authorId: User.id } },
						{ flag: FLAGS.PUBLIC },
					],
				},
				skip: offset,
				take: 20,
			});
		} else {
			Posts = await prisma.post.findMany({
				where: {
					flag: FLAGS.PUBLIC,
				},
				skip: offset,
				take: 20,
			});
		}
		return okResponse(res, { Posts });
	} catch (err) {
		return serverError(res, err);
	}
};
