import { config } from "dotenv";
config();

import express, { NextFunction, Request, Response, json } from "express";
import rateLimit from "express-rate-limit";
import router from "./router";

const app = express();
const PORT = 5000;

app.use(json());

app.listen(PORT, () => {
	console.log("express is live");
});

//I'm assuming a rate of 100 reqs per second as medium load and 200 as heavy
const limiter = rateLimit({
	windowMs: 1 * 60 * 1000,
	max: 12000,
	standardHeaders: true,
	legacyHeaders: false,
});

app.use(limiter);
app.use("/", router);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	console.log(err);
	return res.status(500).json("SERVER ERROR");
});
