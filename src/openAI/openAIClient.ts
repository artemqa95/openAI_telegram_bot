import {createReadStream} from "fs";
import {Configuration, OpenAIApi} from "openai";
import {SessionData} from "./models";

export class OpenAIClient {
  openAIApi: OpenAIApi;
  constructor(authKey: string) {
    const configuration = new Configuration({apiKey: authKey});
    this.openAIApi = new OpenAIApi(configuration);
  }

  async speechToText(mp3Path: string) {
    try {
      const response = await this.openAIApi.createTranscription(createReadStream(mp3Path) as any, "whisper-1");

      return response.data.text;
    } catch (e) {
     // eslint-disable-next-line
      console.log('Ошибка создания транскрипции:', e);

      return "";
    }
  }

  async askOpenAI(messages: SessionData["messages"]) {
    try {
      const response = await this.openAIApi.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages,
      });

      return response.data.choices[0].message?.content || "";
    } catch (e) {
      // eslint-disable-next-line
      console.log('Ошибка генерации ответа:', e);

      return "";
    }
  }
}