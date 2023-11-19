import {Telegraf} from "telegraf";
import {message} from "telegraf/filters";
import {code} from "telegraf/format";
import {fileManager} from "../fileManager/fileManager";
import {EMessageRoleEnum, IBotContext, SessionData} from "../openAI/models";
import {OpenAIClient} from "../openAI/openAIClient";
import {parseError} from "../utils";

export class OpenAIBot {
  telegramBot: Telegraf<IBotContext>;
  openAIClient: OpenAIClient;
  usersData: Map<string, SessionData> = new Map();
  chatIdToSendErrors: string = "";
  // eslint-disable-next-line no-undef
  interval: NodeJS.Timer | null = null;
  constructor(telegramKey: string, openAIKey: string, errorSendingChatId: string) {
    this.telegramBot = new Telegraf<IBotContext>(telegramKey);
    this.openAIClient = new OpenAIClient(openAIKey);
    this.chatIdToSendErrors = errorSendingChatId;
    try {
      this.monitorInactiveUsersData();
      this.onGetCommand();
      this.onGetTextMessage();
      this.onGetVoiceMessage();
      this.onExit();
      this.startOpenAIBot();
    } catch (e) {
      this.sendErrorToDeveloper(e);
      this.monitorInactiveUsersData();
    }
  }

  private sendErrorToDeveloper = (e: unknown) => {
    const error = parseError(e, true);
    this.telegramBot.telegram.sendMessage(this.chatIdToSendErrors, error);
  };

  private getKey(ctx: IBotContext) {
    return `${ctx.chat.id}:${ctx.from.id}`;
  }

  private clearCurrentUserStore(mapKey: string) {
    this.usersData.delete(mapKey);
  }

  private monitorInactiveUsersData() {
    const hour = 60 * 60 * 1000;
    const timeDifferenceForClear = 4 * hour;
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.interval = setInterval(() => {
      const currentDate = Date.now();
      const filteredDataArray = Array.from(this.usersData)
        .filter(([, userData]) => {
          return currentDate - userData.lastMessageDate <= timeDifferenceForClear;
        });
      this.usersData = new Map(filteredDataArray);
    }, hour);
  }

  public addMessage(mapKey: string, role: EMessageRoleEnum, msg: string) {
    const currentMessage = {role, content: msg};
    const currentUserStore = this.usersData.get(mapKey);
    if (currentUserStore) {
      currentUserStore.lastMessageDate = Date.now();
      currentUserStore.messages.push(currentMessage);

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
    if (typeof answerFromOpenAI !== "string") {
      const error = parseError(answerFromOpenAI.error);
      await ctx.reply("Ошибка! Что-то пошло не так." + "\n" + error);

      return;
    }
    this.addMessage(currentUserKey, EMessageRoleEnum.Assistant, answerFromOpenAI);
    try {
      // eslint-disable-next-line camelcase
      await ctx.telegram.sendMessage(ctx.chat.id, answerFromOpenAI, {parse_mode: "Markdown"});
    } catch {
      await ctx.telegram.sendMessage(ctx.chat.id, answerFromOpenAI);
    }
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
      this.telegramBot.hears("/start", async (ctx) => {
        const currentUserKey = this.getKey(ctx);
        this.clearCurrentUserStore(currentUserKey);
        const welcomeText = "Приветствую! \nЗадайте свой вопрос OpenAI в текстовом или аудиоформате";

        await ctx.telegram.sendMessage(ctx.chat.id, welcomeText);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.log("Ошибка при выполнении команды", e);
    }
  }

  private onExit() {
    process.once("SIGINT", () => this.telegramBot.stop("SIGINT"));
    process.once("SIGTERM", () => this.telegramBot.stop("SIGTERM"));
  }

  public onGetTextMessage() {
    this.telegramBot.on(message("text"), async (ctx) => {
      try {
        await ctx.reply(code("Ожидаем ответа..."));
        const {text} = ctx.message;

        return this.forwardOpenAIAnswer(ctx, text);
      } catch (e) {
          // eslint-disable-next-line
          console.log('Ошибка обработки текстового сообщения', e);
      }
    });
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