import config from "config";
import {Telegraf} from "telegraf";
import {message} from "telegraf/filters";
import {fileManager} from "../fileManager/fileManager.ts";


export class OpenAIBot {
  bot: Telegraf;
  constructor() {
    this.bot = new Telegraf(config.get("TELEGRAM_DEV_KEY"));
    console.log(fileManager.aaa);
    this.onGetTextMessage();
    this.onGetVoiceMessage();
    this.onStartDialog();
    this.onExit();
    this.bot.launch();
  }

  public onStartDialog() {
    this.bot.start(async (ctx) => {
      try {
        const welcomeText = "Приветствую! \nЗадайте свой вопрос OpenAI в текстовом или аудиоформате";

        await ctx.telegram.sendMessage(ctx.chat.id, welcomeText);
      } catch {
        // eslint-disable-next-line no-console
        console.log("Ошибка инициации чата");
      }
    });
  }

  private onExit() {
    process.once("SIGINT", () => this.bot.stop("SIGINT"));
    process.once("SIGTERM", () => this.bot.stop("SIGTERM"));
  }

  public onGetTextMessage() {
    try {
      this.bot.on(message("text"), (ctx) => {
        // eslint-disable-next-line no-magic-numbers
        return ctx.telegram.sendMessage(ctx.chat.id, JSON.stringify(ctx.message, null, 2));
      });
    } catch {
      // eslint-disable-next-line
      console.log('Ошибка обработки текстового сообщения');
    }
  }

  public onGetVoiceMessage() {
    this.bot.on(message("voice"), async (ctx) => {
      try {
        const fileId = ctx.message.voice.file_id;
        const fileURL = await ctx.telegram.getFileLink(fileId);
        const userId = await ctx.message.from.id.toString();
        // const localOggPath = await fileManager.saveAudioFile(fileURL.href, userId);
        // const localMP3Path = await fileManager.convertOggToMp3(localOggPath);
        // await ctx.telegram.sendMessage(ctx.chat.id, localMP3Path);
      } catch {
        // eslint-disable-next-line
        console.log('Ошибка обработки аудиосообщения');
      }
    });
  }
}