import { Router, type IRouter } from "express";
import healthRouter from "./health";
import botRouter from "./bot";
import opportunitiesRouter from "./opportunities";
import tradesRouter from "./trades";
import analyticsRouter from "./analytics";
import configRouter from "./config";
import walletRouter from "./wallet";
import executeRouter from "./execute";
import authRouter from "./auth";
import { requireAuth } from "../middlewares/auth.js";

const router: IRouter = Router();

// Public: health check + auth routes (no token required)
router.use(healthRouter);
router.use("/", authRouter);

// All other routes require a valid session
router.use(requireAuth);
router.use(botRouter);
router.use(opportunitiesRouter);
router.use(tradesRouter);
router.use(analyticsRouter);
router.use(configRouter);
router.use(walletRouter);
router.use(executeRouter);

export default router;
