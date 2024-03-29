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
      const stream = createReadStream(mp3Path);
      const response = await this.openAIApi.createTranscription(stream as any, "whisper-1");

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
        model: "gpt-4-1106-preview",
        messages,
      });

      return response.data.choices[0].message?.content || "";
    } catch (e) {
      // eslint-disable-next-line
      console.log('Ошибка генерации ответа:', e);

      return {error: e};
    }
  }
}