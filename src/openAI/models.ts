import {Context} from "telegraf";

// eslint-disable-next-line no-shadow
export enum EMessageRoleEnum {
  System = "system",
  User = "user",
  Assistant = "assistant"
}

export interface ChatCompletionRequestMessage {
  role: EMessageRoleEnum;
  content: string;
  name?: string;
}

export interface SessionData {
  messages: ChatCompletionRequestMessage[],
  lastMessageDate: number,
}

export interface IBotContext extends Context {
  chat: NonNullable<Context["chat"]>
  from: NonNullable<Context["from"]>
}