import { NextFunction, Request, Response } from "express";

import jwt from "jsonwebtoken";

const secret = process.env.JWT_SECRET;

export const createToken = (name: string, key: string) => {
	const token = jwt.sign({ name, key }, secret);
	return token;
};

export const checkAuth = (req: Request, res: Response, next: NextFunction) => {
	const bearer = req.headers.authorization;
	const [, token] = bearer.split(" ");
	if (!bearer || !token) {
		req.body.auth = false;
	} else {
		try {
			const isValid = jwt.verify(token, secret);
			req.body.auth = isValid;
		} catch (err) {
			console.log(err);
			req.body.auth = false;
		}
	}

	return next();
};
