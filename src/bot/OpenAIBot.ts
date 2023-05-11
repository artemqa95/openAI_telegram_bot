import config from "config";
import {Telegraf} from "telegraf";
import {message} from "telegraf/filters";

export class OpenAIBot {
  bot: Telegraf;
  constructor() {
    this.bot = new Telegraf(config.get("TELEGRAM_DEV_KEY"));
    this.onGetMessage();
    this.onStart();
    this.onExit();
    this.bot.launch();
  }

  private onStart() {
    this.bot.start((ctx) => {
      const welcomeText = "Приветствую! \nЗадайте свой вопрос OpenAI в текстовом или аудиоформате";

      return ctx.telegram.sendMessage(ctx.chat.id, welcomeText);
    });
  }

  private onExit() {
    process.once("SIGINT", () => this.bot.stop("SIGINT"));
    process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
  }

  public onGetMessage() {
    this.bot.on(message("text"), (ctx) => {
      return ctx.reply("👍");
    });
  }
}