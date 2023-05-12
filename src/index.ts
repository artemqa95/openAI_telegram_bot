import config from "config";
import {OpenAIBot} from "./bot/openAIBot.ts";

// eslint-disable-next-line
new OpenAIBot(config.get("TELEGRAM_BOT_KEY"), config.get("CHAT_GPT_DEV_KEY"));