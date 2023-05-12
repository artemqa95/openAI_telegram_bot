import {createReadStream} from "fs";
import {Configuration, OpenAIApi} from "openai";
import {ChatCompletionRequestMessage, EMessageRoleEnum} from "./models.ts";
export class OpenAIClient {
  openAIApi: OpenAIApi;
  messages: Record<string, ChatCompletionRequestMessage[]> = {};
  constructor(authKey: string) {
    const configuration = new Configuration({apiKey: authKey});
    this.openAIApi = new OpenAIApi(configuration);
  }

  async speechToText(mp3Path: string) {
    try {
      const response = await this.openAIApi.createTranscription(createReadStream(mp3Path), "whisper-1");

      return response.data.text;
    } catch (e) {
     // eslint-disable-next-line
      console.log('Ошибка создания транскрипции:', e);

      return "";
    }
  }

  async askOpenAI(question: string, userId: string) {
    try {
      if (!this.messages[userId]) {
        this.messages[userId] = [];
      }
      this.messages[userId].push({role: EMessageRoleEnum.User, content: question});
      const response = await this.openAIApi.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: this.messages[userId],
      });

      return response.data.choices[0].message?.content || "";
    } catch (e) {
      // eslint-disable-next-line
      console.log('Ошибка генерации ответа:', e);

      return "";
    }
  }
}