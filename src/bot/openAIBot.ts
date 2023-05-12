import {Telegraf, session} from "telegraf";
import {message} from "telegraf/filters";
import {code} from "telegraf/format";
import {fileManager} from "../fileManager/fileManager.ts";
import {EMessageRoleEnum, IBotContext, SessionData} from "../openAI/models.ts";
import {OpenAIClient} from "../openAI/openAIClient.ts";

export class OpenAIBot {
  telegramBot: Telegraf<IBotContext>;
  openAIClient: OpenAIClient;
  // initialSession: SessionData = {messages: []};
  constructor(telegramKey: string, openAIKey: string) {
    this.telegramBot = new Telegraf<IBotContext>(telegramKey);
    this.openAIClient = new OpenAIClient(openAIKey);
    this.telegramBot.use(session());
    this.useCommands();
    this.onGetTextMessage();
    this.onGetVoiceMessage();
    this.onStartDialog();
    this.onExit();
    this.startOpenAIBot();
  }

  public async sendErrorMessage(ctx: {reply: (text: string) => void}) {
    await ctx.reply("Ошибка! Что-то пошло не так.");
  }

  public addMessage(messages: SessionData["messages"], role: EMessageRoleEnum, msg: string) {
    messages.push({role, content: msg});
  }

  public async forwardOpenAIAnswer(ctx: IBotContext, question: string) {
    ctx.session ??= {messages: []};
    const {messages} = ctx.session;
    this.addMessage(messages, EMessageRoleEnum.User, question);
    const answerFromOpenAI = await this.openAIClient.askOpenAI(messages);
    if (!answerFromOpenAI) {
      return this.sendErrorMessage(ctx);
    }
    this.addMessage(messages, EMessageRoleEnum.Assistant, answerFromOpenAI);
    await ctx.telegram.sendMessage(ctx.chat.id, answerFromOpenAI);
  }

  public useCommands() {
    this.telegramBot.hears("/new", async (ctx) => {
      ctx.session = {messages: []};
      await ctx.reply("Все прошлые вопросы забыты");
    });
  }

  public async startOpenAIBot() {
    return this.telegramBot.launch();
  }

  public onStartDialog() {
    this.telegramBot.start(async (ctx) => {
      try {
        ctx.session = {messages: []};
        const welcomeText = "Приветствую! \nЗадайте свой вопрос OpenAI в текстовом или аудиоформате";

        await ctx.telegram.sendMessage(ctx.chat.id, welcomeText);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log("Ошибка инициации чата", e);
      }
    });
  }

  private onExit() {
    process.once("SIGINT", () => this.telegramBot.stop("SIGINT"));
    process.once("SIGTERM", () => this.telegramBot.stop("SIGTERM"));
  }

  public onGetTextMessage() {
    try {
      this.telegramBot.on(message("text"), async (ctx) => {
        await ctx.reply(code("Ожидаем ответа..."));
        const {text} = ctx.message;

        return this.forwardOpenAIAnswer(ctx, text);
      });
    } catch (e) {
      // eslint-disable-next-line
      console.log('Ошибка обработки текстового сообщения', e);
    }
  }

  public onGetVoiceMessage() {
    this.telegramBot.on(message("voice"), async (ctx) => {
      try {
        await ctx.reply(code("Ожидаем ответа..."));
        const fileId = ctx.message.voice.file_id;
        const fileURL = await ctx.telegram.getFileLink(fileId);
        const userId = ctx.message.from.id.toString();
        const localOggPath = await fileManager.saveAudioFile(fileURL.href, userId);
        const localMP3Path = await fileManager.convertOggToMp3(localOggPath);
        const text = await this.openAIClient.speechToText(localMP3Path);
        await ctx.reply(code("Ваш запрос:", text));

        return this.forwardOpenAIAnswer(ctx, text);
      } catch (e) {
        // eslint-disable-next-line
        console.log('Ошибка обработки аудиосообщения', e);
      }
    });
  }
}