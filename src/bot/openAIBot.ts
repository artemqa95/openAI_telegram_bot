import {Telegraf} from "telegraf";
import {message} from "telegraf/filters";
import {code} from "telegraf/format";
import {fileManager} from "../fileManager/fileManager.ts";
import {EMessageRoleEnum, IBotContext, SessionData} from "../openAI/models.ts";
import {OpenAIClient} from "../openAI/openAIClient.ts";

export class OpenAIBot {
  telegramBot: Telegraf<IBotContext>;
  openAIClient: OpenAIClient;
  usersData: Map<string, SessionData> = new Map();
  constructor(telegramKey: string, openAIKey: string) {
    this.telegramBot = new Telegraf<IBotContext>(telegramKey);
    this.openAIClient = new OpenAIClient(openAIKey);
    this.monitorInactiveUsersData();
    this.onGetCommand();
    this.onGetTextMessage();
    this.onGetVoiceMessage();
    this.onStartDialog();
    this.onExit();
    this.startOpenAIBot();
  }

  private getKey(ctx: IBotContext) {
    return `${ctx.chat.id}:${ctx.from.id}`;
  }

  private clearCurrentUserStore(mapKey: string) {
    this.usersData.delete(mapKey);
  }

  private monitorInactiveUsersData() {
    const period = 60 * 60 * 1000;
    const timeDifferenceForClear = 4 * 60 * 60 * 1000;
    setInterval(() => {
      const currentDate = Date.now();
      const filteredDataArray = Array.from(this.usersData)
        .filter(([, userData]) => {
          return currentDate - userData.lastMessageDate <= timeDifferenceForClear;
        });
      this.usersData = new Map(filteredDataArray);
    }, period);
  }

  public async sendErrorMessage(ctx: {reply: (text: string) => void}) {
    await ctx.reply("Ошибка! Что-то пошло не так.");
  }

  public addMessage(mapKey: string, role: EMessageRoleEnum, msg: string) {
    const currentMessage = {role, content: msg};
    const currentUserStore = this.usersData.get(mapKey);
    if (currentUserStore) {
      currentUserStore.messages.push(currentMessage);
      currentUserStore.lastMessageDate = Date.now();

      return currentUserStore.messages;
    }
    const newMessages = [currentMessage];
    this.usersData.set(mapKey, {messages: newMessages, lastMessageDate: Date.now()});

    return newMessages;
  }

  public async forwardOpenAIAnswer(ctx: IBotContext, question: string) {
    const currentUserKey = this.getKey(ctx);
    const messages = this.addMessage(currentUserKey, EMessageRoleEnum.User, question);
    const answerFromOpenAI = await this.openAIClient.askOpenAI(messages);
    if (!answerFromOpenAI) {
      return this.sendErrorMessage(ctx);
    }
    this.addMessage(currentUserKey, EMessageRoleEnum.Assistant, answerFromOpenAI);
    await ctx.telegram.sendMessage(ctx.chat.id, answerFromOpenAI);
  }

  public async startOpenAIBot() {
    return this.telegramBot.launch();
  }

  public onGetCommand() {
    try {
      this.telegramBot.hears("/new", async (ctx) => {
        const currentUserKey = this.getKey(ctx);
        this.clearCurrentUserStore(currentUserKey);
        await ctx.reply("Все прошлые вопросы забыты");
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("Ошибка при выполнении команды", e);
    }
  }

  public onStartDialog() {
    this.telegramBot.start(async (ctx) => {
      try {
        const currentUserKey = this.getKey(ctx);
        this.clearCurrentUserStore(currentUserKey);
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
        fileManager.removeFile(localMP3Path);
        await ctx.reply(code("Ваш запрос:", text));

        return this.forwardOpenAIAnswer(ctx, text);
      } catch (e) {
        // eslint-disable-next-line
        console.log('Ошибка обработки аудиосообщения', e);
      }
    });
  }
}